resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = local.private_subnet_ids
}

resource "aws_db_instance" "postgres" {
  identifier             = "oasis-staging"
  engine                 = "postgres"
  engine_version         = "15.14"
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  db_name                = "oasis"
  username               = var.db_username
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # The master password is managed outside Terraform for the existing staging DB.

  # Backup and retention settings
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  # Protection settings
  apply_immediately   = false
  deletion_protection = false
  skip_final_snapshot = true

  # Other settings
  publicly_accessible = false
  multi_az            = false
  storage_encrypted   = true

  tags = merge(var.default_tags, {
    Name = "${local.name_prefix}-database"
  })
}
