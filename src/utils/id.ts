// IDs cortos base36 de 6 chars. Suficiente para no colisionar dentro de un
// mundo (~2.1B combinaciones). No es UUID real — para nuestro caso (props,
// agents, rooms, zonas en un solo save) alcanza y es legible al debugear.
export function uid(): string {
  return Math.random().toString(36).slice(2, 8);
}
