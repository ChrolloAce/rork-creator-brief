import { Shell } from "@/components/Shell";
import { formats } from "@/lib/formats";
import { hookCategories } from "@/lib/hooks";
import { overviewId } from "@/lib/nav";

export default function Home() {
  return (
    <Shell
      formats={formats}
      hookCategories={hookCategories}
      activeId={overviewId}
    />
  );
}
