variable "environment" { type = string }
variable "aws_region" { type = string }

locals {
  azs = ["${var.aws_region}a", "${var.aws_region}b"]
  cidr = "10.0.0.0/16"
}

resource "aws_vpc" "cherny" {
  cidr_block           = local.cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "cherny-${var.environment}" }
}

resource "aws_internet_gateway" "cherny" {
  vpc_id = aws_vpc.cherny.id
  tags   = { Name = "cherny-${var.environment}" }
}

resource "aws_subnet" "public" {
  count             = length(local.azs)
  vpc_id            = aws_vpc.cherny.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(local.cidr, 4, count.index)
  map_public_ip_on_launch = true
  tags = { Name = "cherny-public-${count.index}-${var.environment}" }
}

resource "aws_subnet" "private" {
  count             = length(local.azs)
  vpc_id            = aws_vpc.cherny.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(local.cidr, 4, count.index + 4)
  tags = { Name = "cherny-private-${count.index}-${var.environment}" }
}

resource "aws_eip" "nat" {
  count  = 1
  domain = "vpc"
}

resource "aws_nat_gateway" "cherny" {
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id
  tags          = { Name = "cherny-${var.environment}" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.cherny.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.cherny.id
  }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

output "vpc_id"             { value = aws_vpc.cherny.id }
output "public_subnet_ids"  { value = aws_subnet.public[*].id }
output "private_subnet_ids" { value = aws_subnet.private[*].id }
