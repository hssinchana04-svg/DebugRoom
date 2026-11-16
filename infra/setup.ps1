# =============================================================
#  DebugRoom - One-time AWS Infrastructure Setup
#  Run from the project root: .\infra\setup.ps1
#  Creates: VPC, EC2 t2.micro, RDS PostgreSQL, ECR repo
# =============================================================

param(
    [string]$Region  = "us-east-1",
    [string]$AppName = "debugroom"
)

function Write-Step    { param($m) Write-Host "" ; Write-Host "==> $m" -ForegroundColor Cyan }
function Write-OK      { param($m) Write-Host "    OK  $m" -ForegroundColor Green }
function Write-Waiting { param($m) Write-Host "    ... $m" -ForegroundColor Yellow }

# ── Verify AWS CLI ────────────────────────────────────────────
Write-Step "Verifying AWS CLI..."
$identity = aws sts get-caller-identity 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: AWS CLI not configured. Run 'aws configure' first." -ForegroundColor Red
    exit 1
}
$AccountId = (aws sts get-caller-identity --query Account --output text)
Write-OK "Account: $AccountId  |  Region: $Region"

# ── DB Password ───────────────────────────────────────────────
$DbPassword = ""
while ($DbPassword.Length -lt 8) {
    $sec = Read-Host "Set a password for RDS PostgreSQL (min 8 chars)" -AsSecureString
    $DbPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    if ($DbPassword.Length -lt 8) { Write-Host "    Too short, try again." -ForegroundColor Red }
}

# =============================================================
# 1. VPC
# =============================================================
Write-Step "Creating VPC..."
$VpcId = (aws ec2 create-vpc --cidr-block 10.0.0.0/16 --region $Region --query Vpc.VpcId --output text)
aws ec2 create-tags --resources $VpcId --tags Key=Name,Value="$AppName-vpc" --region $Region | Out-Null
aws ec2 modify-vpc-attribute --vpc-id $VpcId --enable-dns-hostnames --region $Region | Out-Null
Write-OK "VPC: $VpcId"

# =============================================================
# 2. Internet Gateway
# =============================================================
Write-Step "Creating Internet Gateway..."
$IgwId = (aws ec2 create-internet-gateway --region $Region --query InternetGateway.InternetGatewayId --output text)
aws ec2 attach-internet-gateway --internet-gateway-id $IgwId --vpc-id $VpcId --region $Region | Out-Null
aws ec2 create-tags --resources $IgwId --tags Key=Name,Value="$AppName-igw" --region $Region | Out-Null
Write-OK "IGW: $IgwId"

# =============================================================
# 3. Subnets
# =============================================================
Write-Step "Creating subnets..."

$PublicSubnetId = (aws ec2 create-subnet --vpc-id $VpcId --cidr-block 10.0.1.0/24 `
    --availability-zone "${Region}a" --region $Region --query Subnet.SubnetId --output text)
aws ec2 modify-subnet-attribute --subnet-id $PublicSubnetId --map-public-ip-on-launch --region $Region | Out-Null
aws ec2 create-tags --resources $PublicSubnetId --tags Key=Name,Value="$AppName-public" --region $Region | Out-Null

$PrivSub1 = (aws ec2 create-subnet --vpc-id $VpcId --cidr-block 10.0.2.0/24 `
    --availability-zone "${Region}a" --region $Region --query Subnet.SubnetId --output text)
$PrivSub2 = (aws ec2 create-subnet --vpc-id $VpcId --cidr-block 10.0.3.0/24 `
    --availability-zone "${Region}b" --region $Region --query Subnet.SubnetId --output text)
aws ec2 create-tags --resources $PrivSub1 --tags Key=Name,Value="$AppName-private-1" --region $Region | Out-Null
aws ec2 create-tags --resources $PrivSub2 --tags Key=Name,Value="$AppName-private-2" --region $Region | Out-Null

Write-OK "Public: $PublicSubnetId | Private: $PrivSub1, $PrivSub2"

# =============================================================
# 4. Route Table
# =============================================================
Write-Step "Configuring routes..."
$RtId = (aws ec2 create-route-table --vpc-id $VpcId --region $Region --query RouteTable.RouteTableId --output text)
aws ec2 create-route --route-table-id $RtId --destination-cidr-block 0.0.0.0/0 --gateway-id $IgwId --region $Region | Out-Null
aws ec2 associate-route-table --route-table-id $RtId --subnet-id $PublicSubnetId --region $Region | Out-Null
Write-OK "Route table: $RtId"

# =============================================================
# 5. Security Groups
# =============================================================
Write-Step "Creating security groups..."

$Ec2Sg = (aws ec2 create-security-group --group-name "$AppName-ec2-sg" `
    --description "DebugRoom EC2" --vpc-id $VpcId --region $Region --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $Ec2Sg --protocol tcp --port 22   --cidr 0.0.0.0/0 --region $Region | Out-Null
aws ec2 authorize-security-group-ingress --group-id $Ec2Sg --protocol tcp --port 4000 --cidr 0.0.0.0/0 --region $Region | Out-Null
aws ec2 create-tags --resources $Ec2Sg --tags Key=Name,Value="$AppName-ec2-sg" --region $Region | Out-Null

$RdsSg = (aws ec2 create-security-group --group-name "$AppName-rds-sg" `
    --description "DebugRoom RDS" --vpc-id $VpcId --region $Region --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $RdsSg --protocol tcp --port 5432 `
    --source-group $Ec2Sg --region $Region | Out-Null
aws ec2 create-tags --resources $RdsSg --tags Key=Name,Value="$AppName-rds-sg" --region $Region | Out-Null

Write-OK "EC2 SG: $Ec2Sg | RDS SG: $RdsSg"

# =============================================================
# 6. EC2 Key Pair
# =============================================================
Write-Step "Creating SSH key pair..."
$KeyName = "$AppName-key"
$KeyPath = ".\infra\$KeyName.pem"

# Check if key pair exists in this AWS region (not just locally)
$KeyExistsInAws = (aws ec2 describe-key-pairs --key-names $KeyName --region $Region `
    --query "KeyPairs[0].KeyName" --output text 2>$null)

if ($KeyExistsInAws -eq $KeyName -and (Test-Path $KeyPath)) {
    Write-OK "Key pair already exists in $Region and .pem file found - reusing."
} else {
    # Delete old .pem if it's for a different region
    if (Test-Path $KeyPath) { Remove-Item $KeyPath }
    # Delete old key in AWS if it exists (wrong region leftover)
    aws ec2 delete-key-pair --key-name $KeyName --region $Region 2>$null | Out-Null
    # Create fresh key pair in correct region
    aws ec2 create-key-pair --key-name $KeyName --region $Region `
        --query KeyMaterial --output text | Out-File -Encoding ASCII $KeyPath
    Write-OK "Private key saved: $KeyPath"
}

# =============================================================
# 7. IAM Role for EC2 to pull from ECR
# =============================================================
Write-Step "Creating IAM role for EC2 ECR access..."

# Write trust policy to a temp file to avoid quoting issues
$TrustFile = [System.IO.Path]::GetTempFileName() + ".json"
$TrustJson = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
[System.IO.File]::WriteAllText($TrustFile, $TrustJson)

aws iam create-role --role-name "$AppName-ec2-role" `
    --assume-role-policy-document "file://$TrustFile" 2>$null | Out-Null
aws iam attach-role-policy --role-name "$AppName-ec2-role" `
    --policy-arn "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly" 2>$null | Out-Null
aws iam create-instance-profile --instance-profile-name "$AppName-ec2-profile" 2>$null | Out-Null
aws iam add-role-to-instance-profile --instance-profile-name "$AppName-ec2-profile" `
    --role-name "$AppName-ec2-role" 2>$null | Out-Null

Remove-Item $TrustFile -ErrorAction SilentlyContinue
Start-Sleep -Seconds 15
Write-OK "IAM role ready"

# =============================================================
# 8. Launch EC2 t2.micro (Amazon Linux 2 + Docker)
# =============================================================
Write-Step "Finding latest Amazon Linux 2 AMI..."
$AmiId = (aws ec2 describe-images --owners amazon --region $Region `
    --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" "Name=state,Values=available" `
    --query "sort_by(Images, &CreationDate)[-1].ImageId" --output text)
Write-OK "AMI: $AmiId"

Write-Step "Launching EC2 t2.micro..."

# Write user-data to a temp file to avoid here-string/quoting issues
$UserDataFile = [System.IO.Path]::GetTempFileName()
$UserDataScript = @'
#!/bin/bash
yum update -y
amazon-linux-extras install docker -y
systemctl start docker
systemctl enable docker
usermod -aG docker ec2-user
curl -sL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscliv2.zip
cd /tmp && unzip -q awscliv2.zip && ./aws/install && cd /
'@
[System.IO.File]::WriteAllText($UserDataFile, $UserDataScript)

$InstanceId = (aws ec2 run-instances `
    --image-id $AmiId `
    --instance-type t2.micro `
    --key-name $KeyName `
    --security-group-ids $Ec2Sg `
    --subnet-id $PublicSubnetId `
    --iam-instance-profile "Name=$AppName-ec2-profile" `
    --user-data "file://$UserDataFile" `
    --region $Region `
    --query "Instances[0].InstanceId" --output text)

Remove-Item $UserDataFile -ErrorAction SilentlyContinue
aws ec2 create-tags --resources $InstanceId --tags Key=Name,Value="$AppName-server" --region $Region | Out-Null

Write-Waiting "Waiting for EC2 to start (1-2 min)..."
aws ec2 wait instance-running --instance-ids $InstanceId --region $Region

$Ec2Dns = (aws ec2 describe-instances --instance-ids $InstanceId --region $Region `
    --query "Reservations[0].Instances[0].PublicDnsName" --output text)
Write-OK "EC2 running: $Ec2Dns"

# =============================================================
# 9. ECR Repository
# =============================================================
Write-Step "Creating ECR repository..."
$EcrUri = (aws ecr create-repository --repository-name $AppName --region $Region `
    --query "repository.repositoryUri" --output text 2>$null)
if (-not $EcrUri) {
    $EcrUri = (aws ecr describe-repositories --repository-names $AppName --region $Region `
        --query "repositories[0].repositoryUri" --output text)
}
Write-OK "ECR: $EcrUri"

# =============================================================
# 10. RDS PostgreSQL db.t3.micro (free tier)
# =============================================================
Write-Step "Creating RDS subnet group..."
aws rds create-db-subnet-group `
    --db-subnet-group-name "$AppName-subnet-group" `
    --db-subnet-group-description "DebugRoom RDS subnets" `
    --subnet-ids $PrivSub1 $PrivSub2 --region $Region | Out-Null
Write-OK "RDS subnet group created"

Write-Step "Creating RDS PostgreSQL db.t3.micro (~10 min wait)..."
aws rds create-db-instance `
    --db-instance-identifier "$AppName-db" `
    --db-instance-class db.t3.micro `
    --engine postgres `
    --engine-version "15" `
    --master-username "debugroom_user" `
    --master-user-password $DbPassword `
    --db-name "debugroom" `
    --vpc-security-group-ids $RdsSg `
    --db-subnet-group-name "$AppName-subnet-group" `
    --no-publicly-accessible `
    --allocated-storage 20 `
    --storage-type gp2 `
    --backup-retention-period 7 `
    --region $Region | Out-Null

Write-Waiting "Waiting for RDS (~10 minutes - grab a coffee!)..."
aws rds wait db-instance-available --db-instance-identifier "$AppName-db" --region $Region

$RdsHost = (aws rds describe-db-instances --db-instance-identifier "$AppName-db" `
    --region $Region --query "DBInstances[0].Endpoint.Address" --output text)
Write-OK "RDS endpoint: $RdsHost"

# =============================================================
# Generate secrets & output
# =============================================================
$JwtSecret   = [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
$DatabaseUrl = "postgresql://debugroom_user:${DbPassword}@${RdsHost}:5432/debugroom"

$OutputContent = @"
EC2_HOST=$Ec2Dns
DATABASE_URL=$DatabaseUrl
JWT_SECRET=$JwtSecret
ECR_REPOSITORY=$AppName
AWS_REGION=$Region
INSTANCE_ID=$InstanceId
RDS_HOST=$RdsHost
ECR_FULL_URI=$EcrUri
"@
$OutputContent | Out-File -Encoding UTF8 ".\infra\output.txt"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "  SETUP COMPLETE! Add these secrets to GitHub:" -ForegroundColor Green
Write-Host "  Repo > Settings > Secrets > Actions > New repository secret" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  AWS_ACCESS_KEY_ID      = (from your .csv file)"       -ForegroundColor White
Write-Host "  AWS_SECRET_ACCESS_KEY  = (from your .csv file)"       -ForegroundColor White
Write-Host "  AWS_REGION             = $Region"                    -ForegroundColor Yellow
Write-Host "  ECR_REPOSITORY         = $AppName"                   -ForegroundColor Yellow
Write-Host "  EC2_HOST               = $Ec2Dns"                    -ForegroundColor Yellow
Write-Host "  EC2_SSH_KEY            = (contents of .\infra\$KeyName.pem)" -ForegroundColor Yellow
Write-Host "  DATABASE_URL           = $DatabaseUrl"               -ForegroundColor Yellow
Write-Host "  JWT_SECRET             = $JwtSecret"                 -ForegroundColor Yellow
Write-Host ""
Write-Host "  All values saved to: .\infra\output.txt"             -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Next: add secrets, then push to main to deploy!" -ForegroundColor Cyan
Write-Host "  App will be live at: http://$Ec2Dns`:4000/health" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Green
