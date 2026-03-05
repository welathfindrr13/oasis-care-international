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

# Random passwords for secrets (used by Terraform)
# Note: random_password "db" is defined in rds.tf

resource "random_password" "nextauth" {
  length  = 64
  special = true
}

# JWT Secret for API authentication (reuses random_password.jwt from rds.tf)
resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "oasis/staging/JWT_SECRET"
  description             = "JWT Secret for Oasis API staging"
  recovery_window_in_days = 0

  tags = var.default_tags
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt.result
}
