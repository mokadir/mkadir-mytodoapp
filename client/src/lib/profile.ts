import { request } from "./api";

export type Profile = {
  id: string;
  name: string | null;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    todos: number;
    projects: number;
    tags: number;
  };
};

type ProfileResponse = { user: Profile };
type UpdateProfileResponse = { user: Profile; message: string };
type MessageResponse = { message: string };

export const profileApi = {
  get: () => request<ProfileResponse>("/profile"),

  update: (data: { name?: string; bio?: string; avatarUrl?: string | null }) =>
    request<UpdateProfileResponse>("/profile", { method: "PUT", body: data }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<MessageResponse>("/profile/password", { method: "PUT", body: data }),
};
