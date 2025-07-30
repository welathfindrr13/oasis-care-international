import { HttpExceptionFilter } from '../http-exception.filter';
import { BaseHttpException } from '../../errors/base-http.exception';
import { ErrorCode } from '../../errors/error-codes';
import { HttpStatus, ArgumentsHost } from '@nestjs/common';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockHost: ArgumentsHost;
  let mockRequest: any;
  let mockResponse: any;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    
    mockRequest = {
      method: 'GET',
      url: '/test',
    };
    
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };
    
    mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getType: () => 'http',
    } as ArgumentsHost;
  });

  it('should skip non-HTTP contexts', () => {
    const exception = new BaseHttpException(
      ErrorCode.FORBIDDEN,
      'Forbidden',
      HttpStatus.FORBIDDEN
    );

    const graphqlHost = {
      getType: () => 'graphql',
      switchToHttp: jest.fn(),
    } as unknown as ArgumentsHost;

    const result = filter.catch(exception, graphqlHost);

    expect(result).toBe(exception);
    expect(graphqlHost.switchToHttp).not.toHaveBeenCalled();
  });

  it('returns masked payload + code for BaseHttpException', () => {
    const exception = new BaseHttpException(
      ErrorCode.VISIT_OVERLAP,
      'Call 07911 123 456 for assistance',
      HttpStatus.CONFLICT
    );

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith({
      code: ErrorCode.VISIT_OVERLAP,
      message: 'Call 07*** *** *** for assistance',
      timestamp: expect.any(String),
      path: '/test',
    });
  });

  it('masks emails in error messages', () => {
    const exception = new BaseHttpException(
      ErrorCode.FORBIDDEN,
      'Access denied for john.doe@example.com',
      HttpStatus.FORBIDDEN
    );

    filter.catch(exception, mockHost);

    expect(mockJson).toHaveBeenCalledWith({
      code: ErrorCode.FORBIDDEN,
      message: 'Access denied for j***@example.com',
      timestamp: expect.any(String),
      path: '/test',
    });
  });

  it('handles generic Error with INTERNAL_ERROR code', () => {
    const exception = new Error('Something went wrong');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
      timestamp: expect.any(String),
      path: '/test',
    });
  });

  it('preserves custom error codes', () => {
    const exception = new BaseHttpException(
      ErrorCode.TASK_NOT_FOUND,
      'Task not found',
      HttpStatus.NOT_FOUND
    );

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith({
      code: ErrorCode.TASK_NOT_FOUND,
      message: 'Task not found',
      timestamp: expect.any(String),
      path: '/test',
    });
  });
});
