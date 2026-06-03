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

        stage('2. Generate .env from SAM Outputs') {
            steps {
                withAWS(credentials: "${AWS_CRED_ID}", region: "${AWS_REGION}") {
                    echo "Consultando el Stack ${STACK_NAME} en AWS CloudFormation..."
                    script {
                        try {
                            // 1. Obtener la URL de la API usando el Output exacto de tu SAM: ApiEndpoint
                            def apiUrl = sh(
                                script: "aws cloudformation describe-stacks --stack-name ${env.STACK_NAME} --query \"Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue\" --output text",
                                returnStdout: true
                            ).trim()

                            // 2. Obtener la URL de CloudFront usando tu Output actual: CloudFrontURL
                            def cloudfrontUrl = sh(
                                script: "aws cloudformation describe-stacks --stack-name ${env.STACK_NAME} --query \"Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue\" --output text",
                                returnStdout: true
                            ).trim()

                            // Remover el "https://" de la URL de CloudFront para poder buscar su ID limpiamente
                            def domainName = cloudfrontUrl.replace("https://", "")

                            echo "--- [DEBUG SAM OUTPUTS] ---"
                            echo "API Endpoint detectado: '${apiUrl}'"
                            echo "CloudFront URL detectada: '${cloudfrontUrl}'"
                            echo "Dominio para buscar ID: '${domainName}'"
                            echo "---------------------------"

                            // 3. OBTENER EL ID DE CLOUDFRONT DINÁMICAMENTE USANDO EL DOMINIO
                            // Este comando busca en CloudFront cuál distribución tiene asignado ese dominio exacto
                            echo "Buscando el ID de distribución para el dominio ${domainName}..."
                            def cloudfrontId = sh(
                                script: "aws cloudfront list-distributions --query \"DistributionList.Items[?DomainName=='${domainName}'].Id\" --output text",
                                returnStdout: true
                            ).trim()

                            echo "👉 ID de CloudFront encontrado: '${cloudfrontId}'"

                            // Validaciones de Seguridad
                            if (!apiUrl || apiUrl == "None") {
                                error "❌ No se pudo recuperar el ApiEndpoint del stack."
                            }
                            if (!cloudfrontId || cloudfrontId == "None" || cloudfrontId == "") {
                                error "❌ No se pudo determinar el ID de CloudFront para el dominio ${domainName}."
                            }

                            // Guardar variables globales para los siguientes stages
                            env.DYNAMIC_BUCKET_NAME = env.BUCKET_NAME
                            env.DYNAMIC_CLOUDFRONT_ID = cloudfrontId

                            // 4. Crear el archivo .env dinámicamente para Vite (React)
                            echo "Generando archivo .env para el empaquetado..."
                            sh """
                                echo "VITE_API_URL=${apiUrl}" > .env
                                echo "VITE_ENVIRONMENT=${params.ENVIRONMENT}" >> .env
                                echo "Archivo .env creado con éxito:"
                                cat .env
                            """

                        } catch (Exception e) {
                            error "Error al procesar la infraestructura de AWS. Detalles: ${e.message}"
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