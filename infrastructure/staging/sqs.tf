# SQS Dead Letter Queue
resource "aws_sqs_queue" "notifications_dlq" {
  name = "${local.name_prefix}-notifications-dlq.fifo"

  # FIFO queue settings
  fifo_queue                  = true
  content_based_deduplication = true

  # DLQ settings
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Name        = "${local.name_prefix}-notifications-dlq"
    Environment = var.environment
  }
}

# Main SQS Queue with DLQ
resource "aws_sqs_queue" "notifications" {
  name = "${local.name_prefix}-notifications.fifo"

  # FIFO queue settings
  fifo_queue                  = true
  content_based_deduplication = true

  # Queue settings
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 30

  # Dead letter queue configuration
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notifications_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${local.name_prefix}-notifications"
    Environment = var.environment
  }
}

# IAM policy for SQS access
resource "aws_iam_policy" "sqs_notifications" {
  name_prefix = "${local.name_prefix}-sqs-notifications"
  path        = "/"
  description = "IAM policy for SQS notifications access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = [
          aws_sqs_queue.notifications.arn,
          aws_sqs_queue.notifications_dlq.arn
        ]
      }
    ]
  })
}
