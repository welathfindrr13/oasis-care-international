# Secrets will be created and managed by the GitHub Actions deployment workflow
# This file serves as documentation for the expected secrets structure

# The following secrets will be created by the deployment workflow:
# - oasis/staging/DATABASE_URL
# - oasis/staging/NEXTAUTH_SECRET  
# - oasis/staging/NEXTAUTH_URL
# - oasis/staging/COGNITO_CLIENT_SECRET

# Secrets Manager resources for ECS containers and Lambda functions
resource "aws_secretsmanager_secret" "database_url" {
  name                    = "oasis/staging/DATABASE_URL"
  description             = "Database URL for Oasis staging"
  recovery_window_in_days = 0 # For staging, allow immediate deletion

  tags = var.default_tags
}

# JWT Secret for API authentication.
# Terraform manages the secret container metadata, but not the live secret value.
resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "oasis/staging/JWT_SECRET"
  description             = "JWT Secret for Oasis API staging"
  recovery_window_in_days = 0

  tags = var.default_tags
}
