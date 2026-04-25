variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "instance_class" { type = string }
variable "allocated_storage" { type = number }

resource "aws_db_subnet_group" "cherny" {
  name       = "cherny-${var.environment}"
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "rds" {
  name   = "cherny-rds-${var.environment}"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    self        = true
    description = "Allow app tier to connect"
  }
}

resource "aws_db_instance" "cherny" {
  identifier        = "cherny-${var.environment}"
  engine            = "postgres"
  engine_version    = "16.2"
  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage
  storage_encrypted = true # KMS-encrypted at rest
  storage_type      = "gp3"

  db_name  = "cherny"
  username = "cherny"
  # Password managed via AWS Secrets Manager — not hardcoded
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.cherny.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  backup_window           = "02:00-03:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  # Continuous WAL archiving for PITR
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  deletion_protection = var.environment == "prod"
  skip_final_snapshot = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "cherny-final-snapshot" : null

  tags = {
    Name = "cherny-${var.environment}"
  }
}

output "endpoint" {
  value     = aws_db_instance.cherny.endpoint
  sensitive = true
}
