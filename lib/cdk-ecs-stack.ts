import ec2 = require('@aws-cdk/aws-ec2')
import ecs = require('@aws-cdk/aws-ecs')
import ecs_patterns = require('@aws-cdk/aws-ecs-patterns')
import * as cdk from '@aws-cdk/core'

export class CdkEcsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Create VPC and Fargate Cluster
    // NOTE: Limit AZs to avoid reaching resource quotas
    const vpc = new ec2.Vpc(this, 'MyVpc', { maxAzs: 2 })
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc })

    const hoge = 0

    // Instantiate Fargate Service with just cluster and image
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      'FargateService',
      {
        cluster,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        },
      }
    )

    // Setup AutoScaling policy
    const scaling = fargateService.service.autoScaleTaskCount({
      maxCapacity: 2,
    })
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    })
  }
}
