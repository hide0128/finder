
import React from 'react';
import { BuildingOfficeIcon, GlobeAltIcon, MapPinIcon, LinkIcon } from './Icons';

interface ResultCardProps {
  companyName: string;
  domain: string;
  postalCode: string;
  sourceUrls?: Array<{
    uri: string;
    title: string;
  }>;
}

export const ResultCard: React.FC<ResultCardProps> = ({ companyName, domain, postalCode, sourceUrls }) => {
  return (
    <div className="py-4 px-1 sm:px-2"> {/* Padding for content within the list item */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2">
        <h3 className="text-lg font-semibold text-orange-600 flex items-center flex-1 break-all">
          <BuildingOfficeIcon className="h-5 w-5 mr-2.5 flex-shrink-0 text-orange-500" />
          {companyName || "企業情報"}
        </h3>
      </div>

      <div className="space-y-2 pl-0 sm:pl-[28px]"> {/* Indent details to align with icon above */}
        <div className="flex items-start text-sm">
          <GlobeAltIcon className="h-4 w-4 mr-2.5 text-orange-500 flex-shrink-0 mt-0.5" />
          <span className="text-neutral-600 w-20 sm:w-24 flex-shrink-0">ドメイン:</span>
          <span className="text-neutral-800 break-all">
            {domain === "情報なし" ? <span className="text-neutral-500 italic">情報なし</span> : domain}
          </span>
        </div>
        <div className="flex items-start text-sm">
          <MapPinIcon className="h-4 w-4 mr-2.5 text-orange-500 flex-shrink-0 mt-0.5" />
          <span className="text-neutral-600 w-20 sm:w-24 flex-shrink-0">郵便番号:</span>
          <span className="text-neutral-800 break-all">
            {postalCode === "情報なし" ? <span className="text-neutral-500 italic">情報なし</span> : postalCode}
          </span>
        </div>
      </div>

      {sourceUrls && sourceUrls.length > 0 && (
        <div className="mt-3 pt-3 border-t border-amber-200/60 pl-0 sm:pl-[28px]">
          <h4 className="text-xs font-semibold text-neutral-500 mb-1.5 flex items-center">
            <LinkIcon className="h-3.5 w-3.5 mr-1.5 text-orange-500 flex-shrink-0" />
            情報源:
          </h4>
          <ul className="space-y-1 text-xs list-none pl-0">
            {sourceUrls.map((source, index) => (
              <li key={index} className="truncate">
                <a
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-500 hover:underline transition-colors duration-150 ease-in-out"
                  title={source.title || source.uri}
                >
                  {source.title || source.uri}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};