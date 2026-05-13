export type IAuthUser = {
  id: string;
  email: string;
};

export type IAuthSessionResponse = {
  accessToken: string;
  user: IAuthUser;
};

export type IAuthMeResponse = {
  user: IAuthUser;
};
