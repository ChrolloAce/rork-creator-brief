// Reusable script shapes. Each preset carries the beats a script must hit AND
// a finished example written to those exact beats, so "what does good look
// like" is never a guess — for the person writing it or for the model.
//
// Beats and examples follow this app's script convention: one beat per line,
// each line starting with a timestamp like "00:03".

export type StructurePreset = {
  id: string;
  name: string;
  whenToUse: string;
  seconds: number;
  // Shot-by-shot beats. Becomes the format's `structure` list.
  beats: string[];
  // A complete script written to those beats.
  example: string;
};

export const STRUCTURE_PRESETS: StructurePreset[] = [
  {
    id: "hook-struggle-turn-plug",
    name: "Hook → struggle → turn → plug",
    whenToUse:
      "The workhorse. Fits almost any angle. Use this unless you have a reason not to.",
    seconds: 30,
    beats: [
      "00:00 Hook. One line, no setup, no greeting. Must work with the sound off.",
      "00:03 The struggle. Name the thing they actually do, in their words.",
      "00:10 The turn. The truth they are avoiding, or a verse under eight words.",
      "00:18 The plug. Said once, lightly, as the mechanism and not the hero.",
      "00:25 CTA. One ask. Comment, or send it to someone.",
    ],
    example: [
      "00:00 You will scroll for two hours tonight and tell God you were tired.",
      "00:04 You open your phone to check one thing.",
      "00:07 Forty minutes gone.",
      "00:10 And the Bible app is still sitting there with a streak of zero.",
      "00:14 It is not that you do not love God.",
      "00:17 It is that you gave everything else the first yes.",
      "00:21 Seek first the kingdom. First. Not after the feed.",
      "00:25 Prayer Lock locks the apps until you pray. God does not need an app. I did.",
      "00:29 Comment Praise the Lord, and send this to the one person you thought of.",
    ].join("\n"),
  },
  {
    id: "hook-forward",
    name: "Hook-forward (15s)",
    whenToUse:
      "Short, fast, high replay. Cheapest way to test whether a hook works at all.",
    seconds: 15,
    beats: [
      "00:00 Hook. The whole idea in one sentence.",
      "00:04 Escalation. One line that makes it worse, or more specific.",
      "00:08 The truth. The flip. Short.",
      "00:12 Plug plus CTA in a single breath.",
    ],
    example: [
      "00:00 God has been waiting on you all day and you know it.",
      "00:04 You had time for everyone else. Every notification got answered.",
      "00:08 He is not mad. He is just still there.",
      "00:12 Prayer Lock holds your apps until you pray. Send this to someone you love.",
    ].join("\n"),
  },
  {
    id: "testimony",
    name: "Testimony (45s)",
    whenToUse:
      "When there is a real story. Highest trust, slowest reach. Specifics beat adjectives.",
    seconds: 45,
    beats: [
      "00:00 The low point, stated plainly, first person, no drama.",
      "00:06 What it looked like day to day. The boring detail that makes it real.",
      "00:18 The moment it turned. One specific moment, not a general realisation.",
      "00:30 What is different now, with the product as the mechanism.",
      "00:40 CTA.",
    ],
    example: [
      "00:00 For about a year I prayed maybe twice a month and lied about it.",
      "00:06 I would set an alarm for six to read.",
      "00:10 Snooze it, open TikTok in bed, forty minutes deep before my feet hit the floor.",
      "00:15 Every night I said tomorrow. I said tomorrow for a year.",
      "00:20 Then my little brother asked me to pray for him and I did not know how to start.",
      "00:27 That was the moment. Not a sermon. My brother waiting on me.",
      "00:33 Now the apps do not open until I have prayed. That is the whole change.",
      "00:38 Sixty one days. I just stopped negotiating with myself at six in the morning.",
      "00:44 Comment Praise the Lord, and go start your streak.",
    ].join("\n"),
  },
  {
    id: "three-things",
    name: "Three things (30s)",
    whenToUse:
      "Listicle. Easy to write, easy to watch, very saveable. One breath per item.",
    seconds: 30,
    beats: [
      "00:00 Hook. Name the list and the payoff.",
      "00:04 One. The most obvious one. Get agreement fast.",
      "00:11 Two. The one they have not heard.",
      "00:18 Three. The one that stings. The plug rides in on it.",
      "00:26 CTA. Ask for the save or the send.",
    ],
    example: [
      "00:00 Three things that killed my prayer life, and none of them were sin.",
      "00:04 One. My phone was the first thing I touched.",
      "00:08 Before my feet were on the floor I had given my attention away.",
      "00:11 Two. I prayed only when I needed something.",
      "00:15 So prayer became a vending machine and I stopped going when I was full.",
      "00:18 Three. I never made it hard to skip.",
      "00:22 Everything I actually do has friction protecting it. Prayer had none.",
      "00:26 So the apps stay locked until I pray. Save this if number three was you.",
    ].join("\n"),
  },
  {
    id: "myth-truth",
    name: "You are doing it wrong (25s)",
    whenToUse:
      "Correction angle. Strong on comments because people argue. Never be smug.",
    seconds: 25,
    beats: [
      "00:00 Hook. The thing everyone believes, stated as fact.",
      "00:04 Why they believe it. Be generous. Understood, not stupid.",
      "00:10 The flip. The actual truth, with the reason.",
      "00:17 What to do instead, product as the how.",
      "00:22 CTA.",
    ],
    example: [
      "00:00 Waiting until you feel like praying is why you never pray.",
      "00:04 And I get it. Nobody wants to fake it in front of God.",
      "00:08 Feels dishonest to show up empty.",
      "00:11 But feelings follow obedience, they do not lead it.",
      "00:15 You will never feel ready. You will only ever start.",
      "00:18 So take the choice away. The apps stay shut until you have prayed.",
      "00:23 Send this to someone who has been waiting to feel ready.",
    ].join("\n"),
  },
  {
    id: "pov-cold-open",
    name: "POV cold open (20s)",
    whenToUse:
      "Skit or acted. The hook is a scene, not a sentence. Must work muted.",
    seconds: 20,
    beats: [
      "00:00 Scene. One line of on-screen text setting the POV. No voiceover yet.",
      "00:03 The bit. Act out the thing everyone does. Two beats maximum.",
      "00:10 The break. Drop the bit, say the real thing to camera.",
      "00:15 Plug plus CTA. Fast.",
    ],
    example: [
      "00:00 POV: you told God you would pray after this one video",
      "00:04 Okay. Last one.",
      "00:07 Okay. Actually last one.",
      "00:10 That was an hour ago. And He is still waiting, which is the crazy part.",
      "00:16 The apps stay locked until you pray. Comment Praise the Lord if you needed this.",
    ].join("\n"),
  },
];

export function getPreset(id: string): StructurePreset | undefined {
  return STRUCTURE_PRESETS.find((p) => p.id === id);
}
