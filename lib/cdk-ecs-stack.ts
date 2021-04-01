import ec2 = require('@aws-cdk/aws-ec2');
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecsPatterns from '@aws-cdk/aws-ecs-patterns';
import * as cdk from '@aws-cdk/core';
import { SubnetType } from '@aws-cdk/aws-ec2';

export class CdkEcsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    console.log(this.availabilityZones);

    // Create VPC and Fargate Cluster
    // NOTE: Limit AZs to avoid reaching resource quotas
    const vpc = new ec2.Vpc(this, 'MyVpc', {
      cidr: '10.110.0.0/16',
      maxAzs: 3,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Public',
          cidrMask: 24,
          subnetType: SubnetType.PUBLIC,
        },
      ],
    });
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: 'ecs-sample',
      containerInsights: true,
    });

    // Instantiate Fargate Service with just cluster and image
    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'FargateService',
      {
        cluster,
        assignPublicIp: true,
        publicLoadBalancer: true,

        cpu: 256,
        desiredCount: 1,
        memoryLimitMiB: 512,

        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        },
      }
    );
    //
    // // Setup AutoScaling policy
    // const scaling = fargateService.service.autoScaleTaskCount({
    //   maxCapacity: 2,
    // });
    // scaling.scaleOnCpuUtilization('CpuScaling', {
    //   targetUtilizationPercent: 50,
    //   scaleInCooldown: cdk.Duration.seconds(60),
    //   scaleOutCooldown: cdk.Duration.seconds(60),
    // });
  }
}
