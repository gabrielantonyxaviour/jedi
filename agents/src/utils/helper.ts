export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const wrapMetaLlamaPrompt = (prompt: string) => {
  return `<|begin_of_text|><|start_header_id|>user<|end_header_id|>
  ${prompt}
  <|eot_id|>
  <|start_header_id|>assistant<|end_header_id|>`;
};
