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
  subnet_ids = local.private_subnet_ids
}

resource "aws_db_instance" "postgres" {
  identifier             = "oasis-staging"
  engine                 = "postgres"
  engine_version         = "15.6"
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  db_name                = "oasis"
  username               = var.db_username
  password               = random_password.db.result
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # Backup and retention settings
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  # Protection settings
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name_prefix}-db-final-snapshot"

  # Other settings
  publicly_accessible = false
  multi_az            = false
  storage_encrypted   = true

  tags = merge(var.default_tags, {
    Name = "${local.name_prefix}-database"
  })
}
