-- Store the (encrypted) GitHub access token for the repo picker
ALTER TABLE "User" ADD COLUMN "githubAccessToken" TEXT;
