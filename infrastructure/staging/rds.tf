resource "random_password" "db" {
  length  = 16
  special = true
}

resource "random_password" "jwt" {
  length  = 32
  special = true
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "postgres" {
  identifier              = "${local.name_prefix}-db"
  engine                  = "postgres"
  engine_version          = "15.6"
  instance_class          = var.db_instance_class
  allocated_storage       = 20
  db_name                 = "oasis_staging"
  username                = var.db_username
  password                = random_password.db.result
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  skip_final_snapshot     = true
  publicly_accessible     = false
  multi_az                = false
  storage_encrypted       = true
}
