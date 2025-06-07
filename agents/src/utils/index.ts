export function parseRepoUrl(repoUrl: string) {
  const url = new URL(repoUrl);
  const owner = url.pathname.split("/")[1];
  const repo = url.pathname.split("/")[2];
  return { owner, repo };
}
