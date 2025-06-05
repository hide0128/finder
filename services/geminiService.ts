
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { CompanyInfo } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY is not defined in environment variables. Please set API_KEY.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

function sanitizeAndParseJson(jsonString: string): any {
  let sanitizedString = jsonString.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/si; // Case-insensitive and multiline
  const match = sanitizedString.match(fenceRegex);
  if (match && match[1]) {
    sanitizedString = match[1].trim();
  }

  try {
    return JSON.parse(sanitizedString);
  } catch (e) {
    console.error("Failed to parse JSON:", sanitizedString, e);
    throw new Error("APIからの応答が不正なJSON形式です。");
  }
}

export const fetchCompanyInfo = async (companyName: string): Promise<CompanyInfo> => {
  const prompt = `
あなたは、日本の企業情報を専門に調査するエキスパートリサーチャーです。
指定された企業名「${companyName}」について、以下の情報をGoogle検索の結果を徹底的に調査・検証して、JSON形式で**極めて正確に**提供してください。

あなたの任務は次の通りです:
1.  **最重要: 公式ウェブサイトの特定と検証**:
    *   Google検索を駆使し、「${companyName}」の**主要な公式企業ウェブサイト**を特定してください。
    *   **ウェブサイトの内容をよく確認し、ウェブサイト上に記載されている会社名が、検索対象の「${companyName}」と一致する（または非常に密接に関連する本社名である）ことを確認してください。**
    *   特定したウェブサイトが、**実際にアクセス可能**で、**コンテンツが正しく表示される**こと、そして**間違いなく「${companyName}」の企業全体の情報を提供するメインのコーポレートサイトである**ことを確認してください。
    *   子会社、関連会社、業界団体、無関係なポータルサイト、ニュース記事、求人情報サイト、ブログ、個人のサイトなどではなく、**その企業自身が運営する代表的な公式サイト**を最優先してください。
    *   **日本の企業の場合、可能であれば \`.co.jp\` ドメインや主要な TLD (\`.com\`, \`.jp\` など) を持つ、より信頼性が高く見える公式サイトを優先**してください。ただし、これが絶対ではありません。最も重要なのは、それが真の公式サイトであることです。
    *   例えば、ドメイン名は正しいが古い情報やメンテナンス中のページではないか、一般的なユーザーが企業情報を得るためにアクセスする代表的なサイトであるかを確認してください。

2.  **ドメイン名の抽出 (domain)**:
    *   上記で特定・検証した**公式ウェブサイトのURL**から、**ルートドメイン名**を抽出してください。
    *   \`www.\` プレフィックスは**含めないでください**。
    *   サブドメイン（例: \`shop.example.com\` の \`shop\` 部分）やパス（例: \`example.com/about\` の \`/about\` 部分）は**含めないでください**。
    *   **抽出例**:
        *   公式サイトURLが \`https://www.example.co.jp/\` の場合、ドメインは \`example.co.jp\` です。
        *   公式サイトURLが \`https://main.example-corp.com/company/profile/\` の場合、ドメインは \`example-corp.com\` です。
        *   「石福金属興業株式会社」または「石福金属」の場合、期待されるドメインは \`ishifuku-kinzoku.co.jp\` です。 (検証済みの公式ドメイン)
        *   「京都奉製株式会社」の場合、期待されるドメインは \`omamori.co.jp\` です。 (検証済みの公式ドメイン)
        *   「株式会社光製作所」の場合、期待されるドメインは \`hikariss.co.jp\` です。 (検証済みの公式ドメイン)


3.  **本社所在地の郵便番号 (postalCode)**:
    *   「${companyName}」の**本社**の郵便番号を正確に調べてください。
    *   日本の郵便番号形式で記述してください (例: \`100-0000\`)。

4.  **企業名 (companyName)**:
    *   検索対象の会社名「${companyName}」をそのまま使用してください。この値は変更しないでください。

企業名に「ホールディングス」や「グループ」が含まれる場合でも、その指定された「${companyName}」そのものの情報を検索してください。

**JSON出力形式**:
必ず以下のキーを持つJSONオブジェクトで回答してください。
{
  "companyName": "${companyName}",
  "domain": "抽出したドメイン名",
  "postalCode": "抽出した郵便番号"
}

**情報が見つからない場合**:
万が一、どれだけ調査しても正確な情報が見つからない、または公式サイトが確認できない場合は、該当するフィールドの値として文字列「情報なし」を使用してください。
例: \`{ "companyName": "${companyName}", "domain": "情報なし", "postalCode": "123-4567" }\`

回答は、上記で指定されたJSON形式のオブジェクト**のみ**とし、その他の説明文やテキストは一切含めないでください。
`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.05, // より決定論的で事実に基づいた応答を優先
        topP: 0.9,         // 多様性を少し持たせつつ、高確率な単語を選択
        thinkingConfig: { thinkingBudget: 0 }
      },
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("APIから空の応答が返されました。");
    }
    
    const parsedData = sanitizeAndParseJson(textResponse);

    // API応答の構造と型を厳格に検証
    if (
      !parsedData ||
      typeof parsedData.companyName !== 'string' || // モデルは入力されたcompanyNameを返すはず
      typeof parsedData.domain !== 'string' ||
      typeof parsedData.postalCode !== 'string'
    ) {
      console.warn("API response did not match expected CompanyInfo structure (missing keys or invalid types):", parsedData);
      throw new Error("APIからの応答が期待される形式や型と異なります。");
    }
    
    const sourceUrls = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map(chunk => ({
            uri: chunk.web?.uri || '',
            title: chunk.web?.title || '',
        }))
        .filter(source => source.uri && source.uri.trim() !== '');

    return {
      companyName: companyName, // 常に入力された会社名を使用する
      domain: parsedData.domain,
      postalCode: parsedData.postalCode,
      sourceUrls: sourceUrls && sourceUrls.length > 0 ? sourceUrls : undefined,
    };

  } catch (error: any) {
    console.error(`Error fetching info for "${companyName}":`, error);
    if (error.message.includes("API key not valid")) {
        throw new Error("APIキーが無効です。設定を確認してください。");
    }
    // エラーメッセージが既にカスタムメッセージであるか、一般的なメッセージかを判別
    const isCustomError = error.message.startsWith("APIからの応答が") || 
                          error.message.startsWith("APIキーが無効です") ||
                          error.message.includes("情報取得中にエラーが発生しました");
    
    const errorMessageToThrow = isCustomError ? error.message : `「${companyName}」の情報取得中にエラーが発生しました: ${error.message}`;
    throw new Error(errorMessageToThrow);
  }
};
