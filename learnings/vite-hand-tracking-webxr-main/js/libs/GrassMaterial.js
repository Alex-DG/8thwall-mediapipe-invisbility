const vertexShader = `
uniform vec4 grassParams;
uniform float time;
uniform float uLeanFactor;
uniform float uGrowFactor;
uniform float uWindSpeed;

varying vec3 vColour;
varying vec4 vGrassData;
varying vec3 vNormal;
varying vec3 vWorldPosition;

vec2 quickHash(float p) {
  vec2 r = vec2(
      dot(vec2(p), vec2(17.43267, 23.8934543)),
      dot(vec2(p), vec2(13.98342, 37.2435232)));
  return fract(sin(r) * 1743.54892229);
}

vec3 hash( vec3 p )
{
  p = vec3(
        dot(p,vec3(127.1,311.7, 74.7)),
        dot(p,vec3(269.5,183.3,246.1)),
        dot(p,vec3(113.5,271.9,124.6)));

  return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}

float easeOut(float x, float t) {
  return 1.0 - pow(1.0 - x, t);
}

mat3 rotateY(float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return mat3(
      vec3(c, 0, s),
      vec3(0, 1, 0),
      vec3(-s, 0, c)
  );
}

mat3 rotateAxis(vec3 axis, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;

  return mat3(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
  );
}

float inverseLerp(float v, float minValue, float maxValue) {
  return (v - minValue) / (maxValue - minValue);
}

float remap(float v, float inMin, float inMax, float outMin, float outMax) {
  float t = inverseLerp(v, inMin, inMax);
  return mix(outMin, outMax, t);
}

float saturate(float x) {
  return clamp(x, 0.0, 1.0);
}

vec3 bezier(vec3 P0, vec3 P1, vec3 P2, vec3 P3, float t) {
  return (1.0 - t) * (1.0 - t) * (1.0 - t) * P0 +
        3.0 * (1.0 - t) * (1.0 - t) * t * P1 +
        3.0 * (1.0 - t) * t * t * P2 +
        t * t * t * P3;
}

vec3 bezierGrad(vec3 P0, vec3 P1, vec3 P2, vec3 P3, float t) {
  return 3.0 * (1.0 - t) * (1.0 - t) * (P1 - P0) +
        6.0 * (1.0 - t) * t * (P2 - P1) +
        3.0 * t * t * (P3 - P2);
}

float noise( in vec3 p )
{
  vec3 i = floor( p );
  vec3 f = fract( p );
  
  vec3 u = f*f*(3.0-2.0*f);

  return mix( mix( mix( dot( hash( i + vec3(0.0,0.0,0.0) ), f - vec3(0.0,0.0,0.0) ), 
                        dot( hash( i + vec3(1.0,0.0,0.0) ), f - vec3(1.0,0.0,0.0) ), u.x),
                mix( dot( hash( i + vec3(0.0,1.0,0.0) ), f - vec3(0.0,1.0,0.0) ), 
                        dot( hash( i + vec3(1.0,1.0,0.0) ), f - vec3(1.0,1.0,0.0) ), u.x), u.y),
            mix( mix( dot( hash( i + vec3(0.0,0.0,1.0) ), f - vec3(0.0,0.0,1.0) ), 
                        dot( hash( i + vec3(1.0,0.0,1.0) ), f - vec3(1.0,0.0,1.0) ), u.x),
                mix( dot( hash( i + vec3(0.0,1.0,1.0) ), f - vec3(0.0,1.0,1.0) ), 
                        dot( hash( i + vec3(1.0,1.0,1.0) ), f - vec3(1.0,1.0,1.0) ), u.x), u.y), u.z );
}

uvec2 murmurHash21(uint src) {
  const uint M = 0x5bd1e995u;
  uvec2 h = uvec2(1190494759u, 2147483647u);
  src *= M;
  src ^= src>>24u;
  src *= M;
  h *= M;
  h ^= src;
  h ^= h>>13u;
  h *= M;
  h ^= h>>15u;
  return h;
}

vec2 hash21(float src) {
  uvec2 h = murmurHash21(floatBitsToUint(src));
  return uintBitsToFloat(h & 0x007fffffu | 0x3f800000u) - 1.0;
}

const vec3 BASE_COLOUR = vec3(0.1, 0.4, 0.04);
const vec3 TIP_COLOUR = vec3(0.5, 0.7, 0.3);

const float PI = 3.14159;

void main() {
  int GRASS_SEGMENTS = int(grassParams.x);
  int GRASS_VERTICES = (GRASS_SEGMENTS + 1) * 2;
  float GRASS_PATCH_SIZE = grassParams.y;
  float GRASS_WIDTH = grassParams.z;
  float GRASS_HEIGHT = grassParams.w;

  // Figure out grass offset with dense, even distribution
  vec2 hashedInstanceID = hash21(float(gl_InstanceID));
  
  // Use a more uniform distribution that fills the entire patch
  float radius = hashedInstanceID.x * GRASS_PATCH_SIZE;
  float offsetAngle = hashedInstanceID.y * 2.0 * PI;
  
  // Create base position using polar coordinates
  vec2 basePos = vec2(cos(offsetAngle) * radius, sin(offsetAngle) * radius);
  
  // Add jitter for more natural look, but keep it small to maintain density
  vec2 jitter = (hash21(float(gl_InstanceID) * 3.14159) - 0.5) * GRASS_WIDTH * 2.0;
  
  vec3 grassOffset = vec3(basePos.x + jitter.x, 0.0, basePos.y + jitter.y);  

  vec3 grassBladeWorldPos = (modelMatrix * vec4(grassOffset, 1.0)).xyz;
  vec3 hashVal = hash(grassBladeWorldPos);

  float grassType = saturate(hashVal.z) > 0.99 ? 1.0 : 0.0; // Less flowers, more grass

  // Grass rotation
  float rotationAngle = remap(hashVal.x, -1.0, 1.0, -PI, PI);

  // No tile data - just use consistent height
  float tileGrassHeight = mix(1.0, 1.5, grassType) * remap(hashVal.x, -1.0, 1.0, 0.5, 1.0);
  
  // Figure out vertex id
  int vertFB_ID = gl_VertexID % (GRASS_VERTICES * 2);
  int vertID = vertFB_ID % GRASS_VERTICES;

  // 0 = left, 1 = right
  int xTest = vertID & 0x1;
  int zTest = (vertFB_ID >= GRASS_VERTICES) ? 1 : -1;
  float xSide = float(xTest);
  float zSide = float(zTest);
  float heightPercent = float(vertID - xTest) / (float(GRASS_SEGMENTS) * 2.0);

  float height = GRASS_HEIGHT * tileGrassHeight;
  float width = GRASS_WIDTH;

  if (grassType == 0.0) {
    width *= easeOut(1.0 - heightPercent / 2.0, 4.0) * tileGrassHeight;
  }

  // Calculate the vertex position
  float x = (xSide - 0.5) * width;
  float y = heightPercent * height;
  float z = 0.0;

  // Grass lean factor
  // Use fixed time for wind animation to prevent speed-up effects
  float windTime = time;
  float windStrength = noise(vec3(grassBladeWorldPos.xz * 0.05, 0.0) + windTime);
  float windAngle = uLeanFactor;
  vec3 windAxis = vec3(cos(windAngle), 0.0, sin(windAngle));
  
  // Scale wind effect by wind speed (not time)
  float windEffect = mix(0.3, 1.0, (uWindSpeed - 0.5) / 1.0); // Map 0.5-1.5 to 0.3-1.0
  float windLeanAngle = windStrength * 1.5 * heightPercent * 1.2 * windEffect;

  // Random lean animation with fixed time
  float randomLeanAnimation = noise(vec3(grassBladeWorldPos.xz, windTime * 4.0)) * windStrength * 0.5;
  float leanFactor = remap(hashVal.y, -1.0, 1.0, -0.5, 0.5) + randomLeanAnimation * 0.125 * windEffect;

  // Add the bezier curve for bend
  vec3 p1 = vec3(0.0);
  vec3 p2 = vec3(0.0, 0.33, 0.0);
  vec3 p3 = vec3(0.0, 0.66, 0.0);
  vec3 p4 = vec3(0.0, cos(leanFactor), sin(leanFactor));
  vec3 curve = bezier(p1, p2, p3, p4, heightPercent);

  // Calculate normal
  vec3 curveGrad = bezierGrad(p1, p2, p3, p4, heightPercent);
  mat2 curveRot90 = mat2(0.0, 1.0, -1.0, 0.0) * -zSide;

  y = curve.y * height;
  z = curve.z * height;

  // Generate grass matrix
  mat3 grassMat = rotateAxis(windAxis, windLeanAngle) * rotateY(rotationAngle);

  // Compute full grown offset from the base and interpolate with uGrowFactor
  vec3 fullPosition = grassMat * vec3(x, y, z);
  vec3 grassLocalPosition = grassOffset + uGrowFactor * fullPosition;
  vec3 grassLocalNormal = grassMat * vec3(0.0, curveRot90 * curveGrad.yz);

  // Blend normal
  float distanceBlend = smoothstep(0.0, 10.0, distance(cameraPosition, grassBladeWorldPos));
  grassLocalNormal = mix(grassLocalNormal, vec3(0.0, 1.0, 0.0), distanceBlend * 0.5);
  grassLocalNormal = normalize(grassLocalNormal);

  // Viewspace thicken
  vec4 mvPosition = modelViewMatrix * vec4(grassLocalPosition, 1.0);

  vec3 viewDir = normalize(cameraPosition - grassBladeWorldPos);
  vec3 grassFaceNormal = (grassMat * vec3(0.0, 0.0, -zSide));

  float viewDotNormal = saturate(dot(grassFaceNormal, viewDir));
  float viewSpaceThickenFactor = easeOut(1.0 - viewDotNormal, 5.0) * smoothstep(0.0, 0.2, viewDotNormal);

  // Scale the view-space adjustment by uGrowFactor
  mvPosition.x += uGrowFactor * viewSpaceThickenFactor * (xSide - 0.5) * width * 0.5 * -zSide;

  gl_Position = projectionMatrix * mvPosition;

  // Adjust color based on actual height during growth
  float actualHeightPercent = heightPercent * uGrowFactor;
  vColour = mix(BASE_COLOUR, TIP_COLOUR, actualHeightPercent);

  vNormal = normalize((modelMatrix * vec4(grassLocalNormal, 0.0)).xyz);
  vWorldPosition = (modelMatrix * vec4(grassLocalPosition, 1.0)).xyz;

  vGrassData = vec4(x, heightPercent, xSide, grassType);
}
`

const fragmentShader = `
precision highp float;

uniform vec2 resolution;
uniform vec2 uFadeCenter;
uniform float time;
uniform sampler2D grassTexture1;
uniform sampler2D grassTexture2;
uniform float fadeRadius;
uniform float uGrowFactor;

varying vec3 vColour;
varying vec4 vGrassData;
varying vec3 vNormal;
varying vec3 vWorldPosition;

float inverseLerp(float v, float minValue, float maxValue) {
  return (v - minValue) / (maxValue - minValue);
}

float remap(float v, float inMin, float inMax, float outMin, float outMax) {
  float t = inverseLerp(v, inMin, inMax);
  return mix(outMin, outMax, t);
}

float saturate(float x) {
  return clamp(x, 0.0, 1.0);
}

vec3 lambertLight(vec3 normal, vec3 viewDir, vec3 lightDir, vec3 lightColour) {
  float wrap = 0.5;
  float dotNL = saturate((dot(normal, lightDir) + wrap) / (1.0 + wrap));
  vec3 lighting = vec3(dotNL);
  
  float backlight = saturate((dot(viewDir, -lightDir) + wrap) / (1.0 + wrap));
  vec3 scatter = vec3(pow(backlight, 2.0));

  lighting += scatter;

  return lighting * lightColour;  
}

vec3 hemiLight(vec3 normal, vec3 groundColour, vec3 skyColour) {
  return mix(groundColour, skyColour, 0.5 * normal.y + 0.5);
}

vec3 phongSpecular(vec3 normal, vec3 lightDir, vec3 viewDir) {
  float dotNL = saturate(dot(normal, lightDir));
  
  vec3 r = normalize(reflect(-lightDir, normal));
  float phongValue = max(0.0, dot(viewDir, r));
  phongValue = pow(phongValue, 32.0);

  vec3 specular = dotNL * vec3(phongValue);

  return specular;
}

void main() {
  float grassX = vGrassData.x;
  float grassY = vGrassData.y;
  float grassType = vGrassData.w;

  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);

  // Sample base texture based on grass type
  vec2 uv = vGrassData.zy;
  vec4 baseColour;
  if (grassType > 0.5) {
    baseColour = texture2D(grassTexture2, uv);
  } else {
    baseColour = texture2D(grassTexture1, uv);
  }

  // Keep original texture colors for both grass types
  // No additional tinting

  if (baseColour.a < 0.5) {
    discard;
  }

  // Hemisphere light
  vec3 c1 = vec3(1.0, 1.0, 0.75);
  vec3 c2 = vec3(0.05, 0.05, 0.25);
  vec3 ambientLighting = hemiLight(normal, c2, c1);

  // Directional light
  vec3 lightDir = normalize(vec3(-1.0, 0.5, 1.0));
  vec3 lightColour = vec3(1.0);
  vec3 diffuseLighting = lambertLight(normal, viewDir, lightDir, lightColour);

  // Specular
  vec3 specular = phongSpecular(normal, lightDir, viewDir);

  // Fake AO
  float ao = remap(pow(grassY, 2.0), 0.0, 1.0, 0.0625, 1.0);

  // Final base color
  vec3 colour = baseColour.rgb * ambientLighting + specular * 0.25;
  colour *= ao * 1.25;

  // Radial fade
  vec2 center = vec2(uFadeCenter.x, uFadeCenter.y);
  float distFromCenter = length(vWorldPosition.xz - center);
  float fadeFactor = 1.0 - smoothstep(0.5 * fadeRadius, fadeRadius, distFromCenter);

  float finalAlpha = baseColour.a * fadeFactor * uGrowFactor;

  if (finalAlpha < 0.01) discard;

  gl_FragColor = vec4(pow(colour, vec3(1.0 / 2.2)), finalAlpha);
}
`

export class GrassMaterial extends THREE.ShaderMaterial {
  constructor(
    grassTexture1,
    grassTexture2,
    GRASS_SEGMENTS,
    GRASS_PATCH_SIZE,
    GRASS_WIDTH,
    GRASS_HEIGHT
  ) {
    super({
      transparent: true,
      uniforms: {
        grassParams: {
          value: new THREE.Vector4(
            GRASS_SEGMENTS,
            GRASS_PATCH_SIZE,
            GRASS_WIDTH,
            GRASS_HEIGHT
          ),
        },
        grassTexture1: {
          value: grassTexture1,
        },
        grassTexture2: {
          value: grassTexture2,
        },
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(1, 1) },
        fadeRadius: { value: 6.0 },
        uLeanFactor: { value: 0.0 },
        uFadeCenter: { value: new THREE.Vector2(0, 0) },
        uGrowFactor: { value: 0 },
        uWindSpeed: { value: 1.0 },
      },
      vertexShader,
      fragmentShader,
    })
  }
}
