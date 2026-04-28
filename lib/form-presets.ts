import type { FormField } from "@/lib/db";

export type FormPreset = {
  id: string;
  name: string;
  description: string;
  body: {
    description: string;
    submitMessage: string;
    fields: FormField[];
  };
};

const COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Ireland",
  "Australia",
  "New Zealand",
  "Mexico",
  "Brazil",
  "Argentina",
  "Chile",
  "Colombia",
  "Spain",
  "Portugal",
  "France",
  "Germany",
  "Netherlands",
  "Belgium",
  "Italy",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Poland",
  "Czechia",
  "Romania",
  "Greece",
  "Turkey",
  "Israel",
  "United Arab Emirates",
  "Saudi Arabia",
  "India",
  "Pakistan",
  "Philippines",
  "Indonesia",
  "Vietnam",
  "Thailand",
  "Malaysia",
  "Singapore",
  "Japan",
  "South Korea",
  "China",
  "Hong Kong",
  "Taiwan",
  "South Africa",
  "Nigeria",
  "Kenya",
  "Egypt",
  "Morocco",
  "Other",
];

const GENDERS = [
  "Female",
  "Male",
  "Non-binary",
  "Prefer not to say",
];

const IDENTITY_FIELDS: FormField[] = [
  {
    id: "first_name",
    type: "short_text",
    label: "First name",
    required: true,
  },
  {
    id: "last_name",
    type: "short_text",
    label: "Last name",
    required: true,
  },
  {
    id: "email",
    type: "email",
    label: "Email",
    required: true,
  },
  {
    id: "instagram_handle",
    type: "short_text",
    label: "Instagram handle",
    placeholder: "@yourhandle",
  },
  {
    id: "tiktok_handle",
    type: "short_text",
    label: "TikTok handle",
    placeholder: "@yourhandle",
  },
];

// Identity without the singular IG/TikTok inputs (those move into the
// repeatable accounts list in the Full preset).
const IDENTITY_FIELDS_BARE: FormField[] = [
  {
    id: "first_name",
    type: "short_text",
    label: "First name",
    required: true,
  },
  {
    id: "last_name",
    type: "short_text",
    label: "Last name",
    required: true,
  },
  {
    id: "email",
    type: "email",
    label: "Email",
    required: true,
  },
];

const CONTENT_ACCESS_FIELDS: FormField[] = [
  {
    id: "social_accounts",
    type: "account_list",
    label: "Your social accounts",
    helpText:
      "Add as many as you want — Instagram, TikTok, YouTube, etc. Just paste your handle or profile URL.",
  },
  {
    id: "drive_video_link",
    type: "url",
    label: "Google Drive / Dropbox link with your content",
    placeholder: "https://drive.google.com/...",
    helpText:
      "Or drop a folder link here so we can review your videos directly.",
  },
];

const ACCOUNT_ACCESS_FIELDS: FormField[] = [
  {
    id: "account_username",
    type: "short_text",
    label: "Account username (for posting)",
    helpText:
      "If you want us to post on your behalf, share the account username here.",
  },
  {
    id: "account_password",
    type: "password",
    label: "Account password",
    helpText:
      "Optional. Only fill this if you've agreed to give us posting access. We strongly recommend changing your password after the campaign.",
  },
  {
    id: "drive_video_link",
    type: "url",
    label: "Google Drive / Dropbox video link",
    placeholder: "https://drive.google.com/...",
    helpText:
      "Or, drop a link to a folder with your raw videos and we'll handle the rest.",
  },
];

const DEMOGRAPHIC_FIELDS: FormField[] = [
  {
    id: "age",
    type: "number",
    label: "Age",
    required: true,
  },
  {
    id: "gender",
    type: "select",
    label: "Gender",
    required: true,
    options: GENDERS,
  },
  {
    id: "headshot",
    type: "image",
    label: "Headshot photo",
    required: true,
    helpText: "A clear photo of your face. PNG/JPG, resized automatically.",
  },
];

const LOCATION_FIELDS: FormField[] = [
  {
    id: "country",
    type: "select",
    label: "Country",
    required: true,
    options: COUNTRIES,
  },
  {
    id: "city",
    type: "short_text",
    label: "City",
    required: true,
  },
  {
    id: "timezone",
    type: "short_text",
    label: "Timezone (optional)",
    placeholder: "EST, PST, GMT+1...",
  },
];

const LOCATION_FIELDS_BARE: FormField[] = [
  {
    id: "country",
    type: "select",
    label: "Country",
    required: true,
    options: COUNTRIES,
  },
  {
    id: "city",
    type: "short_text",
    label: "City",
    required: true,
  },
];

export const FORM_PRESETS: FormPreset[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Start from scratch with no fields.",
    body: {
      description: "",
      submitMessage: "Thanks — we'll be in touch.",
      fields: [],
    },
  },
  {
    id: "identity_and_accounts",
    name: "Identity & accounts",
    description:
      "Name, email, social handles, optional posting credentials or Drive link.",
    body: {
      description:
        "Tell us who you are and how we can post your videos. You can either give us posting access or share a Drive folder with your raw clips — your call.",
      submitMessage:
        "Got it — we'll review your accounts and reach out about next steps.",
      fields: [...IDENTITY_FIELDS, ...ACCOUNT_ACCESS_FIELDS],
    },
  },
  {
    id: "demographics_and_headshot",
    name: "Demographics & headshot",
    description: "Age, gender, and a headshot photo.",
    body: {
      description:
        "A few quick demographic details and a headshot so we can match you with the right campaigns.",
      submitMessage: "Thanks — your profile is in.",
      fields: DEMOGRAPHIC_FIELDS,
    },
  },
  {
    id: "location",
    name: "Location",
    description: "Country, city, and timezone.",
    body: {
      description: "Where are you based?",
      submitMessage: "Got it — thanks!",
      fields: LOCATION_FIELDS,
    },
  },
  {
    id: "full_creator_application",
    name: "Full UGC creator application",
    description:
      "Identity, demographics, headshot, location, social accounts, and a Drive content link.",
    body: {
      description:
        "Apply to be a UGC creator on our roster. This should take a couple minutes. Add all the accounts you want, drop a Drive link with your content, or both.",
      submitMessage:
        "You're in our system. We'll review and reach out within a few days.",
      fields: [
        ...IDENTITY_FIELDS_BARE,
        ...DEMOGRAPHIC_FIELDS,
        ...LOCATION_FIELDS_BARE,
        ...CONTENT_ACCESS_FIELDS,
      ],
    },
  },
];

export function getPreset(id: string): FormPreset | undefined {
  return FORM_PRESETS.find((p) => p.id === id);
}
