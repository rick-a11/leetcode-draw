export const QUESTION_LIBRARY_EXAMPLE = `{
  "format": "leetcode-draw/question-library",
  "version": 1,
  "questions": [
    { "leetcodeId": 1, "name": "两数之和", "difficulty": "简单" },
    { "leetcodeId": 2, "name": "两数相加", "difficulty": "中等" },
    { "leetcodeId": 42, "name": "接雨水", "difficulty": "困难" }
  ]
}`;

export const CONVERSION_PROMPT = `请从我提供的力扣题目网站截图或文本中提取题目，并输出一个可导入 LeetCode Draw 的 JSON 文件。

要求：
1. 每道题必须保留力扣官网的原始题号，字段名固定为 leetcodeId。
2. 只保留力扣官网题号、中文题目名称和难度。
3. 难度只能写为：简单、中等、困难。
4. 去除重复题号和无法确认的题目。
5. 只输出有效 JSON，不要 Markdown、解释、代码围栏或其他文字。
6. JSON 必须严格使用下面的结构：

${QUESTION_LIBRARY_EXAMPLE}`;
