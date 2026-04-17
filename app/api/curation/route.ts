import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const CURATION_PATH = "data/curation.json";

type GithubEnv = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
};

function ghEnv(): GithubEnv | null {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) return null;
  return {
    token,
    owner,
    repo,
    branch: process.env.GITHUB_BRANCH ?? "main",
    filePath: process.env.GITHUB_FILE_PATH ?? CURATION_PATH,
  };
}

export async function GET() {
  // Always read from the local committed file — that's the source of truth
  // the rendered site was built against.
  const p = path.join(process.cwd(), CURATION_PATH);
  try {
    const raw = await readFile(p, "utf8");
    return NextResponse.json({
      ok: true,
      curation: JSON.parse(raw),
      githubConnected: ghEnv() !== null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: `Could not read ${CURATION_PATH}: ${(e as Error).message}`,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const env = ghEnv();
  if (!env) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "GitHub env vars not set — configure GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO on Railway to enable Save.",
      },
      { status: 501 }
    );
  }
  let body: { curation?: unknown; message?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.curation || typeof body.curation !== "object") {
    return NextResponse.json(
      { error: "missing curation payload" },
      { status: 400 }
    );
  }

  // 1) fetch current file SHA
  const getUrl = `https://api.github.com/repos/${env.owner}/${env.repo}/contents/${env.filePath}?ref=${env.branch}`;
  const getRes = await fetch(getUrl, {
    headers: {
      Authorization: `Bearer ${env.token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "rork-creator-brief-admin",
    },
    cache: "no-store",
  });
  if (!getRes.ok) {
    const detail = await getRes.text().catch(() => "");
    return NextResponse.json(
      {
        ok: false,
        error: `GitHub getContents failed: ${getRes.status} ${detail}`,
      },
      { status: 502 }
    );
  }
  const getData = (await getRes.json()) as { sha: string };

  // 2) put new file contents
  const newContent = JSON.stringify(body.curation, null, 2) + "\n";
  const putUrl = `https://api.github.com/repos/${env.owner}/${env.repo}/contents/${env.filePath}`;
  const putRes = await fetch(putUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "rork-creator-brief-admin",
    },
    body: JSON.stringify({
      message: body.message ?? "chore(curation): update via admin",
      content: Buffer.from(newContent, "utf8").toString("base64"),
      sha: getData.sha,
      branch: env.branch,
    }),
  });
  if (!putRes.ok) {
    const detail = await putRes.text().catch(() => "");
    return NextResponse.json(
      {
        ok: false,
        error: `GitHub putContents failed: ${putRes.status} ${detail}`,
      },
      { status: 502 }
    );
  }
  const putData = (await putRes.json()) as {
    commit?: { sha?: string; html_url?: string };
  };
  return NextResponse.json({
    ok: true,
    commit: putData.commit,
  });
}
