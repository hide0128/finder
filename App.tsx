
import React, { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { CompanyInfo } from './types';
import { fetchCompanyInfo } from './services/geminiService';
import { TextAreaInput } from './components/TextAreaInput';
import { Button } from './components/Button';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorDisplay } from './components/ErrorDisplay';
import { ResultCard } from './components/ResultCard';
import { SearchIcon, BuildingOfficeIcon, InboxIcon, DownloadIcon } from './components/Icons';

// Helper function to validate if a string is likely a company name
const isLikelyCompanyName = (name: string): boolean => {
  const trimmedName = name.trim();

  if (trimmedName.replace(/[^a-zA-Z0-9\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/g, '').length < 1) {
    return false;
  }
   if (trimmedName.length < 2 && !/[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/.test(trimmedName)) { // Allow single Japanese characters as company names
    return false;
  }

  if (/^https?:\/\//i.test(trimmedName)) {
    return false;
  }

  const simpleDomainPattern = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/i;
  const wwwDomainPattern = /^www\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/i;

  if (simpleDomainPattern.test(trimmedName) || wwwDomainPattern.test(trimmedName)) {
    const hasNoSpaces = !/\s/.test(trimmedName);
    const hasNoJapaneseChars = !/[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/.test(trimmedName);
    const companyTypePattern = /\b(K\.K\.|Y\.K\.|G\.K\.|Co\.?|Ltd\.?|Inc\.?|Corp\.?|LLC|PLC|GmbH|AG|S\.A\.S?|SAS|S\.R\.L|Pty|NV|BV|AB|OY|AS|SpA|株式会社|有限会社|合同会社|股份|公司|集团|ホールディングス|グループ)\b/i;
    const hasNoCompanyType = !companyTypePattern.test(trimmedName);
    
    if (hasNoSpaces && hasNoJapaneseChars && hasNoCompanyType) {
      return false; 
    }
  }

  if (/^\d+$/.test(trimmedName) && trimmedName.length > 2) {
    return false;
  }

  if (/^\d{3}-\d{4}$/.test(trimmedName)) {
    return false;
  }

  if (/^(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{3,4}([-.\s]?\d{1,4})?$/.test(trimmedName) && trimmedName.replace(/\D/g, '').length >= 7) {
    return false;
  }
  
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(trimmedName) && !trimmedName.includes(" ")) { 
    return false;
  }

  return true;
};

// Helper function to clean company name suffixes
const cleanCompanyNameSuffix = (name: string): string => {
  const companyTypeEndings = [
    '株式会社', '合名会社', '合資会社', '合同会社', '有限会社', // Japanese
    'K.K.', 'Y.K.', 'G.K.', // Japanese abbreviations (escaped for regex if used directly, but here just for string matching)
    'Co., Ltd.', 'Ltd.', 'Inc.', 'Corp.', 'LLC', 'PLC', // Common English
    'Corporation', 'Incorporated', 'Company', 'Limited', // Full English names
    'GmbH', 'AG', 'S.A.S', 'SAS', 'S.R.L', 'Pty', 'NV', 'BV', 'AB', 'OY', 'AS', 'SpA' // Other international
  ];

  let currentName = name.trim();

  for (const type of companyTypeEndings) {
    const typeIndex = currentName.lastIndexOf(type);
    if (typeIndex !== -1) {
      const prefixWithType = currentName.substring(0, typeIndex + type.length); // e.g., "新明工業株式会社"
      const suffixPart = currentName.substring(typeIndex + type.length);     // e.g., "-2(移管)"

      const annotationPatternWithHyphen = /^\s*-[a-zA-Z0-9_-]+\s*\([\s\S]*?\)\s*$/;
      const annotationPatternParenthesesOnly = /^\s*\([\s\S]*?\)\s*$/;

      if (suffixPart.trim().length > 0) { 
        if (annotationPatternWithHyphen.test(suffixPart)) {
          return prefixWithType.trim(); 
        } else if (annotationPatternParenthesesOnly.test(suffixPart)) {
           const contentMatch = suffixPart.match(annotationPatternParenthesesOnly);
           if (contentMatch) {
             const innerContent = contentMatch[0].replace(/^\s*\(\s*|\s*\)\s*$/g, ""); 
             if (!/\b(japan|usa|uk|europe|asia|tokyo|osaka|branch|office|holding)\b/i.test(innerContent) || innerContent.length > 20) {
                return prefixWithType.trim(); 
             }
           }
        }
      }
    }
  }
  return currentName; 
};

interface SelectedCopyColumns {
  companyName: boolean;
  domain: boolean;
  postalCode: boolean;
}

const App: React.FC = () => {
  const [companyNameInput, setCompanyNameInput] = useState<string>('');
  const [companyInfoList, setCompanyInfoList] = useState<CompanyInfo[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCopyColumns, setSelectedCopyColumns] = useState<SelectedCopyColumns>({
    companyName: true,
    domain: true,
    postalCode: true,
  });

  const companyNamesForButtonCount = useMemo(() => {
    return companyNameInput
      .split('\n')
      .map(name => name.trim())
      .map(name => cleanCompanyNameSuffix(name)) 
      .filter(name => name.length > 0 && isLikelyCompanyName(name))
      .length;
  }, [companyNameInput]);

  const handleSearch = useCallback(async () => {
    const cleanedInputs = companyNameInput
      .split('\n')
      .map(name => name.trim())
      .map(name => cleanCompanyNameSuffix(name)) 
      .filter(name => name.length > 0);

    const companyNames = cleanedInputs.filter(name => isLikelyCompanyName(name));

    if (companyNames.length === 0) {
      if (cleanedInputs.length > 0 || companyNameInput.split('\n').map(n=>n.trim()).filter(n=>n.length > 0).length > 0) {
        setError('入力されたテキストに有効な会社名が見つかりませんでした。会社名以外の情報（URL、メールアドレス、電話番号、郵便番号、または末尾の注釈等）は除外されます。');
      } else {
        setError('会社名を入力してください。各会社名は改行で区切ってください。');
      }
      setCompanyInfoList(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setCompanyInfoList(null);

    const results = await Promise.allSettled(
      companyNames.map(name => fetchCompanyInfo(name))
    );

    const fetchedCompanyInfo: CompanyInfo[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        fetchedCompanyInfo.push(result.value);
      } else {
        const reason = result.reason as any;
        const errorMessage = reason?.message || '不明なエラー';
        errors.push(`「${companyNames[index]}」: ${errorMessage}`);
      }
    });

    setCompanyInfoList(fetchedCompanyInfo);

    if (errors.length > 0) {
      const failureDetails = errors.map(e => `• ${e}`).join('\n');
      if (fetchedCompanyInfo.length > 0) {
        setError(`一部の企業情報の取得に失敗しました。\n詳細は以下の通りです:\n${failureDetails}`);
      } else {
        setError(`すべての企業情報の取得に失敗しました。\n詳細は以下の通りです:\n${failureDetails}`);
      }
    } else if (fetchedCompanyInfo.length === 0 && companyNames.length > 0) {
      setError('入力されたすべての会社について、有効な情報が見つかりませんでした。');
    }
    
    setIsLoading(false);
  }, [companyNameInput]);

  const handleDownloadXLS = useCallback(() => {
    if (!companyInfoList || companyInfoList.length === 0) return;

    const headers = ["会社名", "ドメイン", "郵便番号"];
    const dataToExport = [
      headers,
      ...companyInfoList.map(info => [
        info.companyName,
        info.domain,
        info.postalCode
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(dataToExport);
    const colWidths = [
      { wch: Math.max(20, ...companyInfoList.map(info => info.companyName?.length || 0)) },
      { wch: Math.max(25, ...companyInfoList.map(info => info.domain?.length || 0)) },
      { wch: Math.max(10, ...companyInfoList.map(info => info.postalCode?.length || 0)) }
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "企業情報");

    XLSX.writeFile(wb, "企業情報検索結果.xlsx");
  }, [companyInfoList]);

  const handleCopyColumnChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setSelectedCopyColumns(prev => ({ ...prev, [name]: checked }));
  };

  const copyableResultsText = useMemo(() => {
    if (!companyInfoList || companyInfoList.length === 0) {
      return '';
    }
    return companyInfoList
      .map(info => {
        const parts = [];
        if (selectedCopyColumns.companyName) parts.push(info.companyName || '');
        if (selectedCopyColumns.domain) parts.push(info.domain || '');
        if (selectedCopyColumns.postalCode) parts.push(info.postalCode || '');
        return parts.join('\t');
      })
      .join('\n');
  }, [companyInfoList, selectedCopyColumns]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-100 to-orange-200 text-neutral-800 flex flex-col items-center justify-center p-4 selection:bg-orange-500 selection:text-white">
      <div className="bg-white shadow-2xl rounded-xl p-6 md:p-10 w-full max-w-2xl transform transition-all duration-500 hover:scale-[1.02]">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center mb-2">
            <BuildingOfficeIcon className="h-12 w-12 text-orange-500" />
            <h1 className="text-3xl md:text-4xl font-bold text-orange-600 ml-3">企業情報ファインダー</h1>
          </div>
          <p className="text-neutral-600 text-sm md:text-base">会社名からドメインと本社の郵便番号を瞬時に検索します。(Google検索利用)</p>
        </header>

        <div className="space-y-6">
          <TextAreaInput
            id="companyNames"
            label="会社名 (改行で複数入力可)"
            value={companyNameInput}
            onChange={(e) => setCompanyNameInput(e.target.value)}
            placeholder="例: 株式会社〇〇 (改行) 合同会社△△-2(管理用)"
            disabled={isLoading}
            rows={4}
            helperText="複数の会社名を入力する場合は、各会社名を改行で区切ってください。末尾の「-XX(備考)」等は自動的に除去されます。"
          />
          <Button
            onClick={handleSearch}
            disabled={isLoading || !companyNameInput.trim()}
            className="w-full flex items-center justify-center"
            aria-live="polite"
          >
            {isLoading ? (
              <>
                <LoadingSpinner className="h-5 w-5 mr-2" />
                検索中...
              </>
            ) : (
              <>
                <SearchIcon className="h-5 w-5 mr-2" />
                検索 ({companyNamesForButtonCount || 0}件)
              </>
            )}
          </Button>
        </div>

        {error && <ErrorDisplay message={error} className="mt-6" />}

        {companyInfoList && companyInfoList.length > 0 && !isLoading && (
          <div className="mt-8">
            <div className="bg-amber-50/70 p-4 sm:p-6 rounded-lg shadow-xl border border-amber-200 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-orange-600 mb-3">
                検索結果 ({companyInfoList.length}件)
              </h2>
              <ul className="divide-y divide-amber-200">
                {companyInfoList.map((info, index) => (
                  <li key={`${info.companyName}-${index}-${info.domain || 'no-domain'}-${info.postalCode || 'no-postal'}`}>
                    <ResultCard
                      companyName={info.companyName}
                      domain={info.domain}
                      postalCode={info.postalCode}
                      sourceUrls={info.sourceUrls}
                    />
                  </li>
                ))}
              </ul>
            </div>

            {copyableResultsText && (
              <div className="mt-6">
                <label htmlFor="copy-text-area" className="block text-sm font-medium text-orange-700 mb-1">
                  コピー用テキスト (タブ区切り):
                </label>
                <div className="mb-2">
                  <span className="text-sm text-neutral-600 mr-3">表示するカラム:</span>
                  <div className="inline-flex space-x-4">
                    {(Object.keys(selectedCopyColumns) as Array<keyof SelectedCopyColumns>).map((key) => (
                      <label key={key} className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          name={key}
                          checked={selectedCopyColumns[key]}
                          onChange={handleCopyColumnChange}
                          className="h-4 w-4 rounded bg-amber-200 border-amber-400 text-orange-600 focus:ring-orange-500 focus:ring-offset-white"
                          aria-labelledby={`label-copy-${key}`}
                        />
                        <span id={`label-copy-${key}`} className="text-sm text-neutral-700">
                          {key === 'companyName' && '会社名'}
                          {key === 'domain' && 'ドメイン'}
                          {key === 'postalCode' && '郵便番号'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <textarea
                  id="copy-text-area"
                  readOnly
                  value={copyableResultsText}
                  rows={Math.max(3, Math.min(10, companyInfoList.length))}
                  className="w-full px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-neutral-700 placeholder-neutral-500 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none resize-y font-mono text-sm"
                  aria-label="コピー用の整形済み検索結果"
                  onFocus={(e) => e.target.select()}
                />
                 <p className="mt-1 text-xs text-neutral-500">
                  テキストエリア内をクリックすると内容が全選択されます。その後 Ctrl+C (Cmd+C) でコピーしてください。
                </p>
              </div>
            )}

            <div className="mt-8 text-center">
              <Button
                onClick={handleDownloadXLS}
                variant="secondary"
                className="inline-flex items-center"
                aria-label="検索結果をXLS形式でダウンロード"
              >
                <DownloadIcon className="h-5 w-5 mr-2" />
                XLSでダウンロード
              </Button>
            </div>
          </div>
        )}

        {!isLoading && (!companyInfoList || companyInfoList.length === 0) && !error && (
          <div className="mt-8 text-center text-neutral-500 p-6 border-2 border-dashed border-amber-300 rounded-lg">
            <InboxIcon className="h-16 w-16 mx-auto mb-4 text-orange-400" />
            <p className="text-lg font-medium">検索結果はここに表示されます。</p>
            <p className="text-sm">会社名を1行に1社ずつ入力して検索ボタンを押してください。</p>
          </div>
        )}
      </div>
      <footer className="mt-12 text-center text-neutral-600 text-sm">
        <p>&copy; {new Date().getFullYear()} 企業情報ファインダー. Powered by Gemini API with Google Search.</p>
      </footer>
    </div>
  );
};

export default App;