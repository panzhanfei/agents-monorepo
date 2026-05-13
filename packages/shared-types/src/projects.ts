export type IProjectRow = {
  id: string;
  name: string;
  workspaceRoot: string;
  updatedAt: string;
};

export type IProjectsListResponse = {
  projects: IProjectRow[];
};

export type ICreateProjectBody = {
  name: string;
  workspaceRoot: string;
};

export type IProjectMutationResponse = {
  project: IProjectRow;
};
