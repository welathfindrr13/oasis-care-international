resource "aws_secretsmanager_secret" "database_url" { 
  name = "oasis/staging/DB_URL" 
}

resource "aws_secretsmanager_secret_version" "database_url_version" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.postgres.address}:5432/oasis_staging?schema=public"
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/oasis/staging/JWT_SECRET"
  type  = "SecureString"
  value = random_password.jwt.result
}
