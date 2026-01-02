export interface Category {
  id: number;
  name: string;
  assignable: boolean;
  level: number;
  parentId?: number | null;
  parent?: Category | null; 
  children?: Category[];
  color?: string;
  root?: boolean;
}
