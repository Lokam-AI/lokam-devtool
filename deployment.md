# Deployment Guide — lokam-devtool

Backend: AWS RDS + ECS Express Mode  
Frontend: Vercel (self-managed)

---

## 1. RDS (PostgreSQL)

**Console → RDS → Create database**

- Engine: PostgreSQL 16
- Template: Production
- DB instance identifier: `lokam-devtool`
- Master username: `devtool`
- Master password: generate and save securely
- Instance: `db.t3.micro`
- Storage: 20 GB gp3
- VPC: default (or dedicated)
- Public access: **No**
- Security group: create new → `devtool-rds-sg`
- Initial DB name: `devtool`

Note the endpoint after creation:
```
lokam-devtool.xxxx.us-east-1.rds.amazonaws.com
```

---

## 2. ECR Repository

```bash
aws ecr create-repository \
  --repository-name lokam-devtool \
  --region us-east-1
```

Registry URI: `<account_id>.dkr.ecr.us-east-1.amazonaws.com/lokam-devtool`

---

## 3. Secrets Manager

**Console → Secrets Manager → Store a new secret → Other type**

Paste as JSON:

```json
{
  "DB_HOST": "lokam-devtool.xxxx.us-east-1.rds.amazonaws.com",
  "DB_PORT": "5432",
  "DB_USER": "devtool",
  "DB_PASSWORD": "...",
  "DB_NAME": "devtool",
  "SECRET_KEY": "<openssl rand -hex 32>",
  "FERNET_KEY": "<python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\">",
  "ALLOWED_ORIGINS": "https://your-vercel-app.vercel.app",
  "ENVIRONMENT": "production"
}
```

Secret name: `lokam-devtool/prod`

---

## 4. IAM Roles

ECS Express Mode requires **two** roles.

### 4a. Execution Role

Used by ECS at task startup to pull the image and read secrets.

- **Console → IAM → Roles → Create → ECS Task**
- Attach: `AmazonECSTaskExecutionRolePolicy`
- Inline policy (to read secrets):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:us-east-1:<account_id>:secret:lokam-devtool/prod*"
    }
  ]
}
```

- Role name: `lokam-devtool-execution-role`

### 4b. Infrastructure Role

Used by ECS Express to provision the ALB, security groups, and auto-scaling on your behalf. Only used during create/update/delete — not at runtime.

- **Console → IAM → Roles → Create → ECS Task**
- Attach: `AmazonECSInfrastructureRoleforExpressGatewayServices`
- Role name: `lokam-devtool-infrastructure-role`

### 4c. GitHub Actions Role (OIDC)

Allows GitHub Actions to deploy without long-lived secrets.

- **Console → IAM → Identity providers → Add provider**
  - Provider URL: `https://token.actions.githubusercontent.com`
  - Audience: `sts.amazonaws.com`
- **Create role → Web identity → select the OIDC provider**
  - Condition: `repo:YOUR_ORG/lokam-devtool:ref:refs/heads/main`
- Attach inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage",
        "ecs:CreateCluster",
        "ecs:RegisterTaskDefinition",
        "ecs:CreateExpressGatewayService",
        "ecs:UpdateExpressGatewayService",
        "ecs:DescribeExpressGatewayService",
        "ecs:DescribeClusters",
        "ecs:DescribeServices",
        "ecs:ListServiceDeployments",
        "ecs:DescribeServiceDeployments",
        "ecs:TagResource",
        "ecs:UntagResource",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
```

- Role name: `lokam-devtool-github-actions-role`
- Note the ARN — you'll need it in the workflow.

---

## 5. Security Group for RDS

**`devtool-rds-sg`** — inbound rule:
- Port 5432, source: the security group ECS Express auto-creates (or `0.0.0.0/0` temporarily to verify, then lock down)

ECS Express auto-provisions its own security group for the containers — after first deploy, find it in the EC2 console and add it as the inbound source for the RDS SG.

---

## 6. First Deploy (creates the service)

ECS Express automatically provisions the cluster, ALB, target group, and security groups. Run this once manually or let the GitHub Actions workflow handle it (the action auto-detects create vs update).

```bash
aws ecs create-express-gateway-service \
  --service-name lokam-devtool-api \
  --execution-role-arn arn:aws:iam::<account_id>:role/lokam-devtool-execution-role \
  --infrastructure-role-arn arn:aws:iam::<account_id>:role/lokam-devtool-infrastructure-role \
  --primary-container '{
    "image": "<account_id>.dkr.ecr.us-east-1.amazonaws.com/lokam-devtool:latest",
    "containerPort": 8000,
    "awsLogsConfiguration": {
      "logGroup": "/ecs/lokam-devtool",
      "logStreamPrefix": "ecs"
    },
    "secrets": [
      {"name": "DB_HOST",        "valueFrom": "arn:aws:secretsmanager:us-east-1:<account_id>:secret:lokam-devtool/prod:DB_HOST::"},
      {"name": "DB_PORT",        "valueFrom": "arn:aws:secretsmanager:us-east-1:<account_id>:secret:lokam-devtool/prod:DB_PORT::"},
      {"name": "DB_USER",        "valueFrom": "arn:aws:secretsmanager:us-east-1:<account_id>:secret:lokam-devtool/prod:DB_USER::"},
      {"name": "DB_PASSWORD",    "valueFrom": "arn:aws:secretsmanager:us-east-1:<account_id>:secret:lokam-devtool/prod:DB_PASSWORD::"},
      {"name": "DB_NAME",        "valueFrom": "arn:aws:secretsmanager:us-east-1:<account_id>:secret:lokam-devtool/prod:DB_NAME::"},
      {"name": "SECRET_KEY",     "valueFrom": "arn:aws:secretsmanager:us-east-1:<account_id>:secret:lokam-devtool/prod:SECRET_KEY::"},
      {"name": "FERNET_KEY",     "valueFrom": "arn:aws:secretsmanager:us-east-1:<account_id>:secret:lokam-devtool/prod:FERNET_KEY::"},
      {"name": "ALLOWED_ORIGINS","valueFrom": "arn:aws:secretsmanager:us-east-1:<account_id>:secret:lokam-devtool/prod:ALLOWED_ORIGINS::"},
      {"name": "ENVIRONMENT",    "valueFrom": "arn:aws:secretsmanager:us-east-1:<account_id>:secret:lokam-devtool/prod:ENVIRONMENT::"}
    ]
  }' \
  --health-check-path /api/v1/health \
  --cpu 512 \
  --memory 1024 \
  --region us-east-1
```

The response includes `ingressPaths[].endpoint` — the auto-provisioned HTTPS URL. Note it.

The first deploy runs `alembic upgrade head` automatically (baked into the Docker `CMD`), which also seeds the superadmin account.

---

## 7. GitHub Actions Secrets

**Repo → Settings → Secrets and variables → Actions**

| Secret | Value |
|---|---|
| `AWS_ROLE_ARN` | ARN of `lokam-devtool-github-actions-role` |
| `AWS_REGION` | `us-east-1` |
| `ECR_REPOSITORY` | `lokam-devtool` |
| `ECS_SERVICE_NAME` | `lokam-devtool-api` |
| `ECS_EXECUTION_ROLE_ARN` | ARN of `lokam-devtool-execution-role` |
| `ECS_INFRASTRUCTURE_ROLE_ARN` | ARN of `lokam-devtool-infrastructure-role` |
| `SLACK_DEPLOYMENTS_WEBHOOK_URL` | Slack webhook URL |

---

## 8. Subsequent Deployments

Every push to `main` that touches `server/` triggers the GitHub Actions workflow which:

1. Builds the Docker image tagged with the commit SHA
2. Pushes to ECR
3. Calls `aws-actions/amazon-ecs-deploy-express-service@v1` — auto-detects create vs update
4. Performs a zero-downtime rolling deployment
5. Posts a Slack notification on success or failure

---

## 9. Vercel → point at ECS

Once the ECS Express service is running, set in Vercel project settings → Environment Variables:

```
VITE_API_BASE_URL=https://<ecs-express-generated-endpoint>
```

Update `ALLOWED_ORIGINS` in Secrets Manager to match your Vercel domain, then push to `main` to trigger a redeployment that picks up the new value.

---

## Recommended Order

1. RDS → create DB, note endpoint
2. Secrets Manager → store all env vars
3. ECR → create repo
4. IAM → execution role, infrastructure role, GitHub Actions OIDC role
5. Push image manually to ECR (to verify auth):
   ```bash
   aws ecr get-login-password | docker login --username AWS --password-stdin <registry>
   docker build -t lokam-devtool ./server
   docker tag lokam-devtool:latest <registry>/lokam-devtool:latest
   docker push <registry>/lokam-devtool:latest
   ```
6. Run `create-express-gateway-service` (step 6 above) — note the HTTPS endpoint
7. Verify: `curl https://<endpoint>/api/v1/health`
8. Add GitHub secrets (step 7) → push to `main` → verify CI pipeline end-to-end
9. Set `VITE_API_BASE_URL` in Vercel → redeploy frontend
