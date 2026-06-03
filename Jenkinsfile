pipeline {
    agent any

    parameters {
        choice(name: 'ENVIRONMENT', choices: ['dev', 'staging', 'prod'], description: 'Ambiente para desplegar el Frontend')
    }

    environment {
        AWS_CRED_ID  = 'hgis-credentials-aws'
        AWS_REGION   = 'us-east-1'
        // El nombre del Stack de CloudFormation del cual extraeremos los datos
        STACK_NAME   = "hgis-backend-${params.ENVIRONMENT}"
        BUCKET_NAME     = "hgis-frontend-bucket-${params.ENVIRONMENT}"
    }

    stages {
        stage('1. Checkout') {
            steps {
                echo "Descargando código del Frontend..."
                checkout scm
            }
        }

        stage('2. Generate .env from CloudFormation') {
            steps {
                withAWS(credentials: "${AWS_CRED_ID}", region: "${AWS_REGION}") {
                    echo "Consultando el Stack ${STACK_NAME} en AWS CloudFormation..."
                    script {
                        try {
                            // 1. Obtener el ID de la distribución de CloudFront (Usando comillas simples para proteger la query)
                            def cloudfrontId = sh(
                                script: 'aws cloudformation describe-stacks --stack-name ' + env.STACK_NAME + ' --query "Stacks[0].Outputs[?OutputKey==\'CloudFrontDistributionId\'].OutputValue" --output text',
                                returnStdout: true
                            ).trim()

                            // 2. Obtener la URL del API Gateway (Igual, protegiendo la query de la interpolación de Jenkins)
                            def apiUrl = sh(
                                script: 'aws cloudformation describe-stacks --stack-name ' + env.STACK_NAME + ' --query "Stacks[0].Outputs[?OutputKey==\'ApiGatewayUrl\'].OutputValue" --output text',
                                returnStdout: true
                            ).trim()

                            // Agregar prints explícitos para verificar en la consola de Jenkins la veracidad de los datos
                            echo "--- [DEBUG AWS OUTPUTS] ---"
                            echo "CloudFront ID recuperado: '${cloudfrontId}'"
                            echo "API URL recuperada: '${apiUrl}'"
                            echo "---------------------------"

                            // Control de seguridad: Si AWS devuelve "None" o vacío, detenemos el pipeline con un mensaje claro
                            if (!cloudfrontId || cloudfrontId == "None" || cloudfrontId == "") {
                                error "❌ El output 'CloudFrontDistributionId' no existe o está vacío en el stack ${STACK_NAME}. Verifica tu template.yaml en AWS."
                            }

                            // Guardar en variables de entorno globales del pipeline
                            env.DYNAMIC_BUCKET_NAME = env.BUCKET_NAME
                            env.DYNAMIC_CLOUDFRONT_ID = cloudfrontId

                            // 3. Crear el archivo .env dinámicamente
                            echo "Generando archivo .env para el empaquetado..."
                            sh """
                                echo "VITE_API_URL=${apiUrl}" > .env
                                echo "VITE_ENVIRONMENT=${params.ENVIRONMENT}" >> .env
                                echo "Archivo .env creado con éxito con los siguientes valores:"
                                cat .env
                            """

                        } catch (Exception e) {
                            error "Error al consultar CloudFormation. Asegúrate de que el Stack '${STACK_NAME}' exista en AWS. Detalles: ${e.message}"
                        }
                    }
                }
            }
        }

        stage('3. Build Frontend') {
            steps {
                echo "Limpiando lockfile e instalando dependencias estables..."
                // Reconstruye las resoluciones desde cero
                sh 'pnpm clean --lockfile'
                sh 'pnpm install'
                sh 'pnpm run build'
            }
        }

        stage('4. Deploy to S3 & Invalidate CloudFront') {
            steps {
                withAWS(credentials: "${AWS_CRED_ID}", region: "${AWS_REGION}") {
                    echo "Sincronizando archivos estáticos al bucket recuperado: ${env.DYNAMIC_BUCKET_NAME}..."
                    sh "aws s3 sync dist/ s3://${env.DYNAMIC_BUCKET_NAME} --delete"
                    
                    echo "Limpiando la caché de CloudFront ID: ${env.DYNAMIC_CLOUDFRONT_ID}..."
                    sh "aws cloudfront create-invalidation --distribution-id ${env.DYNAMIC_CLOUDFRONT_ID} --paths '/*'"
                }
            }
        }
    }

    post {
        success {
            echo "¡Frontend desplegado con éxito en ${params.ENVIRONMENT} usando datos dinámicos de CloudFormation!"
        }
        failure {
            echo "El despliegue del Frontend falló. Revisa la configuración del Stack de AWS."
        }
    }
}