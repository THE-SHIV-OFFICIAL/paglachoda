export interface BetaChannel {
  label: string;
  name: string;
  link?: string;
  description?: string;
}

export const BETA_BOT_HUB = "https://t.me/betabot_hub";

export const betaSupport = {
  /** Main Beta Bot support destination */
  bot: {
    label: "Beta Bot Support",
    name: "Beta Bot Hub",
    link: BETA_BOT_HUB,
    description: "Chat with Beta Bot for instant help — broken links, missing titles, download issues.",
  } as BetaChannel,

  updatesChannels: [
    {
      label: "Updates Channel",
      name: "Beta Bot Hub",
      link: BETA_BOT_HUB,
      description: "New releases, server updates and downtime notices.",
    },
  ] as BetaChannel[],

  supportGroups: [
    {
      label: "Support",
      name: "Beta Bot Support",
      link: BETA_BOT_HUB,
      description: "Report a problem and get a reply from the Beta Bot team.",
    },
  ] as BetaChannel[],
};
