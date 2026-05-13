export type IAuthUser = {
  id: string;
  email: string;
};

export type IAuthSessionResponse = {
  accessToken: string;
  refreshToken: string;
  user: IAuthUser;
};

export type IAuthRefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

export type IAuthMeResponse = {
  user: IAuthUser;
};
