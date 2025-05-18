import { Source } from "./source";

export type Article = {
  id: number;
  source: number | Source;
  title: string;
  title_hash: string;
  description: string | null;
  link: string;
  pub_date: string;
  content: string;
  fact_checked: boolean;
  fact_summary: string | null;
};
