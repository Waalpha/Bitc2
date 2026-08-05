export interface Parent {
  id: string;
  schoolId?: string;
  name: string;
  phone: string;
  email?: string;
  occupation?: string;
  address?: string;
  studentIds: string[];
  relation?: string;
  createdAt?: string;
}
