export async function isPublicRepo(repoUrl: string): Promise<boolean> {
  try {
    // Extract owner and repo from URL
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error("Invalid GitHub URL");

    const [, owner, repo] = match;

    // Make API request to check repo visibility
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`
    );

    if (!response.ok) {
      if (response.status === 404) return false;
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const data = await response.json();
    return !data.private;
  } catch (error) {
    console.error("Error checking repo visibility:", error);
    return false;
  }
}
