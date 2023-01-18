import {BlockPublicAccess, Bucket, BucketAccessControl, BucketEncryption} from 'aws-cdk-lib/aws-s3';
import {Construct} from "constructs";
import {CfnOutput, Duration, RemovalPolicy, Stack, StackProps} from "aws-cdk-lib";
import {
  AllowedMethods,
  Distribution,
  HttpVersion,
  OriginAccessIdentity,
  PriceClass,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import {PolicyStatement} from "aws-cdk-lib/aws-iam";
import {DnsValidatedCertificate} from "aws-cdk-lib/aws-certificatemanager";
import {ARecord, HostedZone, RecordTarget} from "aws-cdk-lib/aws-route53";
import {CloudFrontTarget} from "aws-cdk-lib/aws-route53-targets";
import {BucketDeployment, Source} from "aws-cdk-lib/aws-s3-deployment";
import {S3Origin} from "aws-cdk-lib/aws-cloudfront-origins";

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Domain name is defined in `cdk.json`.
    const domainName = this.node.tryGetContext("domainName");
    if (!domainName) {
      throw new Error("The domain name must be set in cdk.json.");
    }
    const wwwDomainName = `www.${domainName}`;

    const hostedZone = HostedZone.fromLookup(this, "Zone", {
      domainName: domainName
    });

    const siteDirectory = this.node.tryGetContext("websitePath");
    if (!siteDirectory) {
      throw new Error("This website path must be set i cdk.json.")
    }

    const staticSiteBucket = new Bucket(this, "WebsiteBucket", {
      encryption: BucketEncryption.S3_MANAGED,
      accessControl: BucketAccessControl.PRIVATE,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      enforceSSL: true,
      // Since this is a static site, automatically deleting the S3 bucket
      // on destroy is fine.  We can always just recreate it.
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });
    new CfnOutput(this, 'Site Bucket', { value: staticSiteBucket.bucketName });

    const staticSiteLoggingBucket = new Bucket(this, "WebsiteLoggingBucket", {
      encryption: BucketEncryption.S3_MANAGED,
      accessControl: BucketAccessControl.PRIVATE,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      enforceSSL: true,
      // Unlike the static site above, we do not want this bucket to
      // be destroyed.
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });
    new CfnOutput(this, 'Logging Bucket', { value: staticSiteLoggingBucket.bucketName });

    // Access Policy
    const accessIdent = new OriginAccessIdentity(this, "CloudFrontAccess");
    const cloudfrontUAP = new PolicyStatement();
    cloudfrontUAP.addActions("s3:GetObject");
    cloudfrontUAP.addPrincipals(accessIdent.grantPrincipal);
    cloudfrontUAP.addResources(staticSiteBucket.arnForObjects("*"));
    staticSiteBucket.addToResourcePolicy(cloudfrontUAP);

    // Create TLS Certs
    const cert = new DnsValidatedCertificate(this, "WebsiteCertificate", {
      domainName: domainName,
      subjectAlternativeNames: [wwwDomainName],
      hostedZone: hostedZone,
      region: "us-east-1",
    });
    new CfnOutput(this, 'Certificate', { value: cert.certificateArn });

    // CloudFront Distribution
    const rootObject = "index.html";

    const cfDist = new Distribution(this, "CloudFrontDist", {
      comment: `CDK CloudFront S3 Dist for ${domainName}`,
      defaultRootObject: rootObject,
      certificate: cert,
      domainNames: [domainName, wwwDomainName],
      enableLogging: true,
      logBucket: staticSiteLoggingBucket,
      logFilePrefix: "distribution-access-logs/",
      logIncludesCookies: false,
      httpVersion: HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: new S3Origin(staticSiteBucket),
        compress: true,
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      errorResponses: [
        {
          // 403 Forbidden
          ttl: Duration.minutes(30),
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: `/${rootObject}`,
        },
        {
          // 404 Forbidden
          ttl: Duration.minutes(30),
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: `/${rootObject}`,
        },
      ]
    });

    new CfnOutput(this, "CfDomainName", {
      value: cfDist.distributionDomainName,
      description: "Use this for `www` CNAME record.",
    });

    new CfnOutput(this, "CfDistId", {
      value: cfDist.distributionId,
      description: "Use for cache invalidation.",
    });

    // Create an alias record for the CloudFront dist in Route53
    new ARecord(this, "SiteAliasRecord", {
      recordName: domainName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(cfDist)),
      zone: hostedZone
    })

    // Deploy our site to S3
    new BucketDeployment(this, "DeployWithInvalidation", {
      sources: [Source.asset(siteDirectory)],
      destinationBucket: staticSiteBucket,
      distribution: cfDist,
      distributionPaths: ['/*'],
    })
  }
}