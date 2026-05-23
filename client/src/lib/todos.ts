import { request } from "./api";

export type Tag = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
};

export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  dueDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
  projectId: string | null;
};

type TodosResponse = { todos: Todo[] };
type TodoResponse = { todo: Todo };
type TagsResponse = { tags: Tag[] };
type TagResponse = { tag: Tag };

export const todosApi = {
  getAll: () => request<TodosResponse>("/todos"),

  create: (data: { title: string; priority?: string; dueDate?: string | null; tagIds?: string[]; projectId?: string }) =>
    request<TodoResponse>("/todos", { method: "POST", body: data }),

  update: (id: string, data: { title?: string; completed?: boolean; priority?: string; dueDate?: string | null; tagIds?: string[]; projectId?: string }) =>
    request<TodoResponse>(`/todos/${id}`, { method: "PUT", body: data }),

  delete: (id: string) =>
    request<{ message: string }>(`/todos/${id}`, { method: "DELETE" }),

  reorder: (orderedIds: string[]) =>
    request<{ message: string }>("/todos/reorder", { method: "PUT", body: { orderedIds } }),

  // Tags
  getTags: () => request<TagsResponse>("/todos/tags/list"),

  createTag: (data: { name: string; color?: string }) =>
    request<TagResponse>("/todos/tags", { method: "POST", body: data }),

  deleteTag: (id: string) =>
    request<{ message: string }>(`/todos/tags/${id}`, { method: "DELETE" }),
};
