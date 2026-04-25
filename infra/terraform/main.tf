terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }

  # Remote state — configure before first apply
  # backend "s3" {
  #   bucket         = "cherny-tfstate-prod"
  #   key            = "cherny/terraform.tfstate"
  #   region         = "af-south-1"
  #   encrypt        = true
  #   dynamodb_table = "cherny-tfstate-lock"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "cherny"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ─── Variables ────────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region — must be af-south-1 for PDPA data residency"
  type        = string
  default     = "af-south-1"

  validation {
    condition     = var.aws_region == "af-south-1"
    error_message = "Cherny must deploy to af-south-1 (Cape Town) for PDPA compliance."
  }
}

variable "environment" {
  description = "dev | staging | prod"
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.medium"
}

variable "db_allocated_storage" {
  type    = number
  default = 100
}

# ─── Modules ──────────────────────────────────────────────────────────────────

module "vpc" {
  source      = "./modules/vpc"
  environment = var.environment
  aws_region  = var.aws_region
}

module "rds" {
  source               = "./modules/rds"
  environment          = var.environment
  vpc_id               = module.vpc.vpc_id
  subnet_ids           = module.vpc.private_subnet_ids
  instance_class       = var.db_instance_class
  allocated_storage    = var.db_allocated_storage
}

module "redis" {
  source      = "./modules/redis"
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids
}

module "s3" {
  source      = "./modules/s3"
  environment = var.environment
  aws_region  = var.aws_region
}

# ─── Outputs ──────────────────────────────────────────────────────────────────

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "rds_endpoint" {
  value     = module.rds.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = module.redis.endpoint
  sensitive = true
}
