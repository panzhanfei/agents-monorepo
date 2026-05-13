export type IProjectRow = {
  id: string;
  name: string;
  workspaceRoot: string;
  gitUrl: string | null;
  updatedAt: string;
};

export type IProjectsListResponse = {
  projects: IProjectRow[];
};

export type ICreateProjectBody = {
  name: string;
  workspaceRoot: string;
  gitUrl?: string | null;
};

export type IUpdateProjectBody = {
  name?: string;
  workspaceRoot?: string;
  gitUrl?: string | null;
};

export type IProjectMutationResponse = {
  project: IProjectRow;
};
