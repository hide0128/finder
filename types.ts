
export interface CompanyInfo {
  companyName: string;
  domain: string;
  postalCode: string;
  sourceUrls?: Array<{
    uri: string;
    title: string;
  }>;
}

export interface ApiError {
  message: string;
  code?: number;
}