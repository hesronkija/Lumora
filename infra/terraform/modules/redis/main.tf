variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }

resource "aws_elasticache_subnet_group" "cherny" {
  name       = "cherny-${var.environment}"
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "redis" {
  name   = "cherny-redis-${var.environment}"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    self        = true
    description = "Allow app tier to connect"
  }
}

resource "aws_elasticache_replication_group" "cherny" {
  replication_group_id = "cherny-${var.environment}"
  description          = "Cherny Redis cache"

  node_type               = var.environment == "prod" ? "cache.r7g.large" : "cache.t4g.micro"
  num_cache_clusters      = var.environment == "prod" ? 2 : 1
  automatic_failover_enabled = var.environment == "prod"
  multi_az_enabled        = var.environment == "prod"

  port                   = 6379
  subnet_group_name      = aws_elasticache_subnet_group.cherny.name
  security_group_ids     = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  maintenance_window = "sun:05:00-sun:06:00"
  snapshot_retention_limit = var.environment == "prod" ? 7 : 1

  tags = { Name = "cherny-${var.environment}" }
}

output "endpoint" {
  value     = aws_elasticache_replication_group.cherny.primary_endpoint_address
  sensitive = true
}
