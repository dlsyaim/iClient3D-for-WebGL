#version 120
attribute vec3 aPosition;
attribute vec2 aTexCoord;
attribute vec4 aColor;
uniform mat4 matModel;
uniform mat4 matMvp;
varying vec2 vTexCoord;
varying vec4 vColor;
void main() {
    vec4 p = vec4(aPosition, 1.0);
    gl_Position =   matMvp * matModel * p;
    vTexCoord = vec2(aTexCoord.x, 1.0-aTexCoord.y);
    vColor = aColor;
}