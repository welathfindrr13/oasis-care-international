# Secrets will be created and managed by the GitHub Actions deployment workflow
# This file serves as documentation for the expected secrets structure

# The following secrets will be created by the deployment workflow:
# - oasis/staging/DATABASE_URL
# - oasis/staging/NEXTAUTH_SECRET  
# - oasis/staging/NEXTAUTH_URL
# - oasis/staging/COGNITO_CLIENT_SECRET

# Random passwords for RDS (used by Terraform)
resource "random_password" "db" {
  length  = 32
  special = true
}

resource "random_password" "nextauth" {
  length  = 64
  special = true
}
