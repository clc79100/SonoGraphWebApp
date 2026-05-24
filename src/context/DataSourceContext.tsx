import { createContext, useContext, useState, type ReactNode } from "react";

export type DataSource = "musicbrainz" | "spotify" | "lastfm";

interface DataSourceCtx {
  dataSource: DataSource;
  setDataSource: (ds: DataSource) => void;
}

const DataSourceContext = createContext<DataSourceCtx>({
  dataSource: "musicbrainz",
  setDataSource: () => {},
});

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const [dataSource, setDataSource] = useState<DataSource>("musicbrainz");
  return (
    <DataSourceContext.Provider value={{ dataSource, setDataSource }}>
      {children}
    </DataSourceContext.Provider>
  );
}

export function useDataSource() {
  return useContext(DataSourceContext);
}
