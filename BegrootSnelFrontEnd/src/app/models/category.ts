export interface Category {
  id: number;
  name: string;
  assignable: boolean;
  level: number;
  parent?: Category | null; 
  children?: Category[];
  color?: string;
}
