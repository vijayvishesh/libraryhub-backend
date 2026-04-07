/* eslint-disable @typescript-eslint/naming-convention */
import axios from 'axios';

export const wrapperApiFunction = async <T, H = Record<string, string>>(
  url: string,
  method: string,
  body?: unknown,
  headers?: H,
  // retry: boolean = true,
): Promise<T> => {
  try {
    const mergedHeaders: H = {
      ...(typeof headers === 'object' ? headers : {}),
      ...(typeof headers !== 'object' ? { 'Content-Type': 'application/json' } : {}),
    } as H;

    // log?.info(
    //   `getData called with URL: ${url}, Method: ${method}, Body: ${JSON.stringify(body)}, Headers: ${JSON.stringify(mergedHeaders)}`,
    // );

    const response = await axios({
      url,
      method: method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
      data: body,
      headers: mergedHeaders as Record<string, string>,
    });

    return response.data as T;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (err.response.data.error) {
      return err.response.data as T;
    }
    throw err.response.data;
  }
};
