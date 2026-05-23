import { request } from "./api";

export type Project = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count: {
    todos: number;
  };
};

type ProjectsResponse = { projects: Project[] };
type ProjectResponse = { project: Project };
type MessageResponse = { message: string };

export const projectsApi = {
  getAll: () => request<ProjectsResponse>("/projects"),

  create: (data: { name: string; color?: string }) =>
    request<ProjectResponse>("/projects", { method: "POST", body: data }),

  update: (id: string, data: { name?: string; color?: string }) =>
    request<ProjectResponse>(`/projects/${id}`, { method: "PUT", body: data }),

  delete: (id: string) =>
    request<MessageResponse>(`/projects/${id}`, { method: "DELETE" }),

  reorder: (orderedIds: string[]) =>
    request<MessageResponse>("/projects/reorder", { method: "PUT", body: { orderedIds } }),
};
