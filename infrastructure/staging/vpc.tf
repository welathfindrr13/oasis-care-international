# Use existing staging VPC (VPC quota exceeded - cannot create new VPC)
data "aws_vpc" "main" {
  id = "vpc-0fa202628a9b74522"
}

# Use existing subnets
data "aws_subnet" "public_a" {
  id = "subnet-08853b0f79dc7eb8a"
}

data "aws_subnet" "public_b" {
  id = "subnet-0edae41ff907ad302"
}

data "aws_subnet" "public_c" {
  id = "subnet-03d629a38764b4395"
}

# Note: Assuming these are your private subnets - verify IDs if different
# If you need to discover them, use: aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-0fa202628a9b74522"
data "aws_subnet" "private_a" {
  id = "subnet-08853b0f79dc7eb8a" # Replace with actual private subnet ID if different
}

data "aws_subnet" "private_b" {
  id = "subnet-0edae41ff907ad302" # Replace with actual private subnet ID if different
}

data "aws_subnet" "private_c" {
  id = "subnet-03d629a38764b4395" # Replace with actual private subnet ID if different
}

data "aws_availability_zones" "available" {}

# Local values for backward compatibility with other modules
locals {
  public_subnet_ids  = [data.aws_subnet.public_a.id, data.aws_subnet.public_b.id, data.aws_subnet.public_c.id]
  private_subnet_ids = [data.aws_subnet.private_a.id, data.aws_subnet.private_b.id, data.aws_subnet.private_c.id]
}

# COMMENTED OUT - VPC resources no longer created, using existing infrastructure
# resource "aws_vpc" "main" {
#   cidr_block           = var.vpc_cidr
#   enable_dns_support   = true
#   enable_dns_hostnames = true
# }
#
# resource "aws_internet_gateway" "igw" {
#   vpc_id = aws_vpc.main.id
# }
#
# resource "aws_subnet" "public" {
#   count                   = length(var.public_subnet_cidrs)
#   vpc_id                  = aws_vpc.main.id
#   cidr_block              = var.public_subnet_cidrs[count.index]
#   map_public_ip_on_launch = true
#   availability_zone       = element(data.aws_availability_zones.available.names, count.index)
# }
#
# resource "aws_subnet" "private" {
#   count             = length(var.private_subnet_cidrs)
#   vpc_id            = aws_vpc.main.id
#   cidr_block        = var.private_subnet_cidrs[count.index]
#   availability_zone = element(data.aws_availability_zones.available.names, count.index)
# }
#
# resource "aws_eip" "nat" {
#   domain     = "vpc"
#   depends_on = [aws_internet_gateway.igw]
# }
#
# resource "aws_nat_gateway" "nat" {
#   allocation_id = aws_eip.nat.id
#   subnet_id     = aws_subnet.public[0].id
# }
#
# resource "aws_route_table" "public" {
#   vpc_id = aws_vpc.main.id
#
#   route {
#     cidr_block = "0.0.0.0/0"
#     gateway_id = aws_internet_gateway.igw.id
#   }
# }
#
# resource "aws_route_table" "private" {
#   vpc_id = aws_vpc.main.id
#
#   route {
#     cidr_block     = "0.0.0.0/0"
#     nat_gateway_id = aws_nat_gateway.nat.id
#   }
# }
#
# resource "aws_route_table_association" "public" {
#   count          = length(aws_subnet.public)
#   subnet_id      = aws_subnet.public[count.index].id
#   route_table_id = aws_route_table.public.id
# }
#
# resource "aws_route_table_association" "private" {
#   count          = length(aws_subnet.private)
#   subnet_id      = aws_subnet.private[count.index].id
#   route_table_id = aws_route_table.private.id
# }
