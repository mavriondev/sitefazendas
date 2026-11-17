export interface MaterialItem {
  key: string;
  label: string;
  kind: "foto" | "video" | "documento";
  ext: string;
  size: number;
  origin: "crm" | "site";
  download_url: string;
  removable: boolean;
}
export interface MaterialLimits { video_bytes: number; file_bytes: number; zip_bytes: number; max_items: number }
export interface MaterialsResponse {
  items: MaterialItem[];
  limits: MaterialLimits;
  warning: string | null;
  pdf_url: string | null;
  enabled: boolean;
}
export interface MaterialShare {
  id: number;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  item_count: number;
  can_revoke: boolean;
}
export interface PublicMaterials {
  title: string;
  expires_at: string;
  items: Array<{ id: number; label: string; kind: MaterialItem["kind"]; size: number }>;
}
