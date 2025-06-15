export const getAgentDisplayName = (
  agentId: string,
  side: "light" | "dark" | null
) => {
  const nameMap = {
    light: {
      github: "C-3PO",
      socials: "Ahsoka Tano",
      leads: "Chewbacca",
      compliance: "Princess Leia Organa",
      ip: "Obi-Wan Kenobi",
      karma: "Luke Skywalker",
      orchestrator: "Yoda",
    },
    dark: {
      github: "General Grievous",
      socials: "Savage Opress",
      leads: "Count Dooku",
      compliance: "Darth Maul",
      ip: "Kylo Ren",
      karma: "Darth Vader",
      orchestrator: "Emperor Palpatine",
    },
  };

  const agents = [
    { id: "github", name: "GitHub" },
    { id: "socials", name: "Socials" },
    { id: "leads", name: "Leads" },
    { id: "compliance", name: "Compliance" },
    { id: "ip", name: "IP" },
    { id: "karma", name: "Karma" },
    { id: "orchestrator", name: "Orchestrator" },
  ];

  if (side && nameMap[side][agentId as keyof typeof nameMap.light]) {
    return nameMap[side][agentId as keyof typeof nameMap.light];
  }
  return agents.find((a) => a.id === agentId)?.name || agentId;
};
