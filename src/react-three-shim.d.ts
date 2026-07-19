declare module "@react-three/fiber" {
  import * as React from "react";

  export interface CanvasProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
    camera?: any;
    gl?: any;
    onCreated?: (state: any) => void;
    shadows?: boolean;
  }

  export class Canvas extends React.Component<CanvasProps> {}
}

declare module "@react-three/drei" {
  import * as React from "react";

  export class OrbitControls extends React.Component<any> {}
}

declare namespace JSX {
  interface IntrinsicElements {
    ambientLight: any;
    directionalLight: any;
    mesh: any;
    sphereGeometry: any;
    meshStandardMaterial: any;
    gridHelper: any;
    axesHelper: any;
  }
}
